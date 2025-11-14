import psycopg2
from typing import List
from app.config import settings
from app.models import SchemaEmbedding


class VectorStore:
    def __init__(self):
        self.conn = None
    
    def _get_connection(self):
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(settings.database_url)
        return self.conn
    
    def setup_schema_embeddings_table(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Enable pgvector extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Create schema embeddings table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS schema_embeddings (
                id SERIAL PRIMARY KEY,
                org_id VARCHAR(255) NOT NULL,
                table_name VARCHAR(255) NOT NULL,
                schema_definition TEXT NOT NULL,
                description TEXT,
                embedding vector({settings.embedding_dimension}),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(org_id, table_name)
            );
        """)
        
        # Create index for vector similarity search
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS schema_embeddings_embedding_idx 
            ON schema_embeddings USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)
        
        conn.commit()
        cursor.close()
    
    def fetch_relevant_schemas(
        self,
        question_embedding: List[float],
        org_id: str,
        top_k: int = None
    ) -> List[SchemaEmbedding]:
        if top_k is None:
            top_k = settings.top_k_schemas
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Convert embedding to PostgreSQL array format
        embedding_str = '[' + ','.join(map(str, question_embedding)) + ']'
        
        # Query using cosine similarity
        cursor.execute(f"""
            SELECT 
                table_name,
                schema_definition,
                description,
                1 - (embedding <=> %s::vector) as similarity_score
            FROM schema_embeddings
            WHERE org_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
        """, (embedding_str, org_id, embedding_str, top_k))
        
        results = cursor.fetchall()
        cursor.close()
        
        schemas = []
        for row in results:
            schemas.append(SchemaEmbedding(
                table_name=row[0],
                schema=row[1],
                description=row[2] or "",
                similarity_score=float(row[3])
            ))
        
        return schemas
    
    def add_schema_embedding(
        self,
        org_id: str,
        table_name: str,
        schema_definition: str,
        embedding: List[float],
        description: str = None
    ) -> bool:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            
            cursor.execute("""
                INSERT INTO schema_embeddings 
                (org_id, table_name, schema_definition, embedding, description)
                VALUES (%s, %s, %s, %s::vector, %s)
                ON CONFLICT (org_id, table_name) 
                DO UPDATE SET 
                    schema_definition = EXCLUDED.schema_definition,
                    embedding = EXCLUDED.embedding,
                    description = EXCLUDED.description;
            """, (org_id, table_name, schema_definition, embedding_str, description))
            
            conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error adding schema embedding: {e}")
            return False
    
    def close(self):
        if self.conn and not self.conn.closed:
            self.conn.close()


vector_store = VectorStore()
