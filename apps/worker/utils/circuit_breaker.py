"""
Circuit Breaker Implementation

This module provides a circuit breaker pattern implementation
for protecting against cascading failures when external services are down.
"""

import time
import threading
from typing import Any, Callable, Optional
from enum import Enum
import structlog

logger = structlog.get_logger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit is open, calls fail fast
    HALF_OPEN = "half_open"  # Testing if service has recovered


class CircuitBreaker:
    """
    Circuit breaker implementation for preventing cascading failures
    
    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Seconds to wait before trying again
        expected_exception: Exception type that counts as failure
        fallback_function: Optional fallback function to call when circuit is open
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        fallback_function: Optional[Callable] = None
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.fallback_function = fallback_function
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        
        self._lock = threading.RLock()
    
    def __call__(self, func: Callable) -> Callable:
        """Decorator to wrap functions with circuit breaker"""
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)
        return wrapper
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    logger.info("Circuit breaker transitioning to HALF_OPEN")
                else:
                    if self.fallback_function:
                        return self.fallback_function(*args, **kwargs)
                    raise Exception("Circuit breaker is OPEN")
            
            try:
                result = func(*args, **kwargs)
                self._on_success()
                return result
                
            except self.expected_exception as exc:
                self._on_failure()
                if self.fallback_function:
                    logger.warning("Circuit breaker calling fallback function", 
                                 reason=str(exc))
                    return self.fallback_function(*args, **kwargs)
                raise exc
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt circuit reset"""
        if self.last_failure_time is None:
            return False
        return time.time() - self.last_failure_time >= self.recovery_timeout
    
    def _on_success(self) -> None:
        """Handle successful call"""
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info("Circuit breaker reset to CLOSED")
        
        self.failure_count = 0
        self.last_failure_time = None
    
    def _on_failure(self) -> None:
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning("Circuit breaker opened", 
                         failure_count=self.failure_count,
                         threshold=self.failure_threshold)
    
    def get_state(self) -> CircuitState:
        """Get current circuit state"""
        with self._lock:
            return self.state
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics"""
        with self._lock:
            return {
                "state": self.state.value,
                "failure_count": self.failure_count,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout": self.recovery_timeout,
                "last_failure_time": self.last_failure_time
            }
    
    def reset(self) -> None:
        """Manually reset circuit breaker to closed state"""
        with self._lock:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.last_failure_time = None
            logger.info("Circuit breaker manually reset to CLOSED")
    
    def force_open(self) -> None:
        """Manually force circuit breaker to open state"""
        with self._lock:
            self.state = CircuitState.OPEN
            self.last_failure_time = time.time()
            logger.info("Circuit breaker manually forced to OPEN")


# Global circuit breaker instances
db_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=Exception
)

redis_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=30,
    expected_exception=Exception
)

external_api_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=120,
    expected_exception=Exception
)