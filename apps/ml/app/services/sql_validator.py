import re
import sqlparse
from sqlparse.sql import Token, TokenList
from sqlparse.tokens import Keyword, DML
from typing import List, Tuple
import psycopg2
from app.config import settings
from app.models import QueryValidationResult


class SQLValidator:
    DANGEROUS_KEYWORDS = [
        'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE',
        'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', 'MERGE', 'REPLACE'
    ]
    
    DANGEROUS_PATTERNS = [
        r';\s*DROP',
        r';\s*DELETE',
        r'--',
        r'/\*.*\*/',
        r'xp_cmdshell',
        r'pg_sleep',
        r'benchmark',
        r'waitfor\s+delay'
    ]
    
    def __init__(self):
        self.allowed_operations = set(op.upper() for op in settings.allowed_operations)
        self.blocked_tables = set(table.lower() for table in settings.blocked_tables)
    
    def validate(self, sql: str) -> QueryValidationResult:
        errors = []
        warnings = []
        
        # Basic validation
        if not sql or not sql.strip():
            errors.append("SQL query is empty")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Parse SQL
        try:
            parsed = sqlparse.parse(sql)
            if not parsed:
                errors.append("Failed to parse SQL query")
                return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        except Exception as e:
            errors.append(f"SQL parsing error: {str(e)}")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Check for multiple statements
        if len(parsed) > 1:
            errors.append("Multiple SQL statements are not allowed")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        statement = parsed[0]
        
        # Check statement type
        statement_type = self._get_statement_type(statement)
        if statement_type not in self.allowed_operations:
            errors.append(f"Operation '{statement_type}' is not allowed. Only {', '.join(self.allowed_operations)} operations are permitted")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Check for dangerous keywords
        dangerous_found = self._check_dangerous_keywords(sql)
        if dangerous_found:
            errors.append(f"Dangerous keywords found: {', '.join(dangerous_found)}")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Check for dangerous patterns
        dangerous_patterns = self._check_dangerous_patterns(sql)
        if dangerous_patterns:
            errors.append(f"Dangerous patterns detected in SQL")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Check for blocked tables
        blocked = self._check_blocked_tables(statement)
        if blocked:
            errors.append(f"Access to blocked tables: {', '.join(blocked)}")
            return QueryValidationResult(is_valid=False, errors=errors, warnings=warnings)
        
        # Check for wildcards in SELECT
        if self._has_select_star(statement):
            warnings.append("Query uses SELECT * which may be inefficient")
        
        # Get cost estimate via EXPLAIN
        estimated_cost = None
        estimated_rows = None
        try:
            estimated_cost, estimated_rows = self._get_query_cost(sql)
            
            if estimated_cost and estimated_cost > settings.max_query_cost:
                errors.append(f"Query cost estimate ({estimated_cost:.2f}) exceeds maximum allowed ({settings.max_query_cost})")
                return QueryValidationResult(
                    is_valid=False,
                    errors=errors,
                    warnings=warnings,
                    estimated_cost=estimated_cost,
                    estimated_rows=estimated_rows
                )
            
            if estimated_rows and estimated_rows > settings.max_rows_estimate:
                warnings.append(f"Query may return many rows ({estimated_rows}), consider adding LIMIT")
        except Exception as e:
            warnings.append(f"Could not estimate query cost: {str(e)}")
        
        # If we got here, query is valid
        return QueryValidationResult(
            is_valid=True,
            sql=sql,
            errors=errors,
            warnings=warnings,
            estimated_cost=estimated_cost,
            estimated_rows=estimated_rows
        )
    
    def _get_statement_type(self, statement: TokenList) -> str:
        for token in statement.tokens:
            if token.ttype is DML:
                return token.value.upper()
        return "UNKNOWN"
    
    def _check_dangerous_keywords(self, sql: str) -> List[str]:
        sql_upper = sql.upper()
        found = []
        for keyword in self.DANGEROUS_KEYWORDS:
            if re.search(r'\b' + keyword + r'\b', sql_upper):
                found.append(keyword)
        return found
    
    def _check_dangerous_patterns(self, sql: str) -> bool:
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, sql, re.IGNORECASE):
                return True
        return False
    
    def _check_blocked_tables(self, statement: TokenList) -> List[str]:
        blocked = []
        tables = self._extract_tables(statement)
        for table in tables:
            if table.lower() in self.blocked_tables:
                blocked.append(table)
        return blocked
    
    def _extract_tables(self, statement: TokenList) -> List[str]:
        tables = []
        from_seen = False
        
        for token in statement.tokens:
            if from_seen:
                if token.ttype is None and isinstance(token, TokenList):
                    # Could be an identifier list
                    for item in token.tokens:
                        if item.ttype in (sqlparse.tokens.Name, None) and not item.is_keyword:
                            table_name = str(item).strip().strip(',')
                            if table_name:
                                tables.append(table_name)
                elif token.ttype in (sqlparse.tokens.Name, None) and not token.is_keyword:
                    table_name = str(token).strip().strip(',')
                    if table_name and not table_name.upper() in ('WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'ORDER', 'LIMIT'):
                        tables.append(table_name)
                        from_seen = False
            
            if token.ttype is Keyword and token.value.upper() == 'FROM':
                from_seen = True
        
        return tables
    
    def _has_select_star(self, statement: TokenList) -> bool:
        for token in statement.tokens:
            if token.ttype is sqlparse.tokens.Wildcard and token.value == '*':
                return True
        return False
    
    def _get_query_cost(self, sql: str) -> Tuple[float, int]:
        try:
            conn = psycopg2.connect(settings.database_url)
            cursor = conn.cursor()
            
            # Use EXPLAIN to get query cost
            explain_sql = f"EXPLAIN (FORMAT JSON) {sql}"
            cursor.execute(explain_sql)
            result = cursor.fetchone()
            
            if result and result[0]:
                plan = result[0][0]
                cost = plan.get('Plan', {}).get('Total Cost', 0)
                rows = plan.get('Plan', {}).get('Plan Rows', 0)
                
                cursor.close()
                conn.close()
                
                return float(cost), int(rows)
            
            cursor.close()
            conn.close()
            return 0.0, 0
            
        except Exception as e:
            raise Exception(f"Failed to get query cost: {str(e)}")


validator = SQLValidator()
