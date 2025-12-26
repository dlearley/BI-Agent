import sqlparse
from typing import Dict, Any


class CostEstimator:
    BASE_COST = 0.1
    
    COST_WEIGHTS = {
        'JOIN': 2.0,
        'LEFT JOIN': 2.0,
        'RIGHT JOIN': 2.0,
        'INNER JOIN': 2.0,
        'OUTER JOIN': 2.5,
        'CROSS JOIN': 5.0,
        'SUBQUERY': 3.0,
        'GROUP BY': 1.5,
        'ORDER BY': 1.2,
        'HAVING': 1.3,
        'DISTINCT': 1.5,
        'UNION': 2.0,
        'AGGREGATE': 1.0,
    }
    
    def estimate_cost(self, sql: str, actual_cost: float = None) -> Dict[str, Any]:
        parsed = sqlparse.parse(sql)[0]
        sql_upper = sql.upper()
        
        cost = self.BASE_COST
        factors = []
        
        # Count JOINs
        join_types = ['CROSS JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN']
        for join_type in join_types:
            count = sql_upper.count(join_type)
            if count > 0:
                weight = self.COST_WEIGHTS.get(join_type, 2.0)
                cost += count * weight
                factors.append(f"{count} {join_type}(s)")
        
        # Check for subqueries
        subquery_count = sql_upper.count('SELECT') - 1
        if subquery_count > 0:
            cost += subquery_count * self.COST_WEIGHTS['SUBQUERY']
            factors.append(f"{subquery_count} subquery(ies)")
        
        # Check for GROUP BY
        if 'GROUP BY' in sql_upper:
            cost += self.COST_WEIGHTS['GROUP BY']
            factors.append("GROUP BY")
        
        # Check for ORDER BY
        if 'ORDER BY' in sql_upper:
            cost += self.COST_WEIGHTS['ORDER BY']
            factors.append("ORDER BY")
        
        # Check for HAVING
        if 'HAVING' in sql_upper:
            cost += self.COST_WEIGHTS['HAVING']
            factors.append("HAVING")
        
        # Check for DISTINCT
        if 'DISTINCT' in sql_upper:
            cost += self.COST_WEIGHTS['DISTINCT']
            factors.append("DISTINCT")
        
        # Check for UNION
        if 'UNION' in sql_upper:
            union_count = sql_upper.count('UNION')
            cost += union_count * self.COST_WEIGHTS['UNION']
            factors.append(f"{union_count} UNION(s)")
        
        # Check for aggregates
        aggregates = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']
        aggregate_count = sum(sql_upper.count(agg) for agg in aggregates)
        if aggregate_count > 0:
            cost += aggregate_count * self.COST_WEIGHTS['AGGREGATE']
            factors.append(f"{aggregate_count} aggregate(s)")
        
        # Use actual cost if available
        final_cost = actual_cost if actual_cost else cost
        
        return {
            'estimated_cost': final_cost,
            'heuristic_cost': cost,
            'actual_cost': actual_cost,
            'complexity_factors': factors,
            'complexity_level': self._get_complexity_level(cost)
        }
    
    def _get_complexity_level(self, cost: float) -> str:
        if cost < 2.0:
            return "LOW"
        elif cost < 5.0:
            return "MEDIUM"
        elif cost < 10.0:
            return "HIGH"
        else:
            return "VERY_HIGH"


cost_estimator = CostEstimator()
