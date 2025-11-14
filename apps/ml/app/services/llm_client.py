from typing import Optional, List
from openai import OpenAI
from app.config import settings


class LLMClient:
    def __init__(self):
        # Allow None for testing purposes
        api_key = settings.llm_api_key or "sk-test-key"
        self.client = OpenAI(
            api_key=api_key,
            base_url=settings.llm_api_base
        )
        self.model = settings.llm_model
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.llm_max_tokens
    
    def generate_sql(self, prompt: str, system_prompt: str = None) -> str:
        messages = []
        
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise Exception(f"LLM API error: {str(e)}")
    
    def generate_embedding(self, text: str) -> List[float]:
        try:
            response = self.client.embeddings.create(
                model="text-embedding-ada-002",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            raise Exception(f"Embedding API error: {str(e)}")


llm_client = LLMClient()
