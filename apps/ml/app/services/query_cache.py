import json
import hashlib
from typing import Optional
import redis
from app.config import settings


class QueryCache:
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.ttl = settings.cache_ttl
    
    def _get_cache_key(self, question: str, org_id: str) -> str:
        combined = f"{org_id}:{question.lower().strip()}"
        return f"nl2sql:cache:{hashlib.sha256(combined.encode()).hexdigest()}"
    
    def get(self, question: str, org_id: str) -> Optional[dict]:
        try:
            key = self._get_cache_key(question, org_id)
            cached = self.redis_client.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set(self, question: str, org_id: str, data: dict) -> bool:
        try:
            key = self._get_cache_key(question, org_id)
            self.redis_client.setex(
                key,
                self.ttl,
                json.dumps(data)
            )
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def invalidate(self, question: str, org_id: str) -> bool:
        try:
            key = self._get_cache_key(question, org_id)
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Cache invalidate error: {e}")
            return False
    
    def clear_all(self, org_id: str = None) -> int:
        try:
            if org_id:
                pattern = f"nl2sql:cache:*"
                keys = self.redis_client.keys(pattern)
                if keys:
                    return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            print(f"Cache clear error: {e}")
            return 0


query_cache = QueryCache()
