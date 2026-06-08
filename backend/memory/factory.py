from memory.redis_client import RedisMemory
from memory.service import MemoryService

_memory: RedisMemory | None = None
_service: MemoryService | None = None


def get_redis_memory() -> RedisMemory:
    global _memory
    if _memory is None:
        _memory = RedisMemory()
    return _memory


def set_redis_memory(memory: RedisMemory) -> None:
    global _memory, _service
    _memory = memory
    _service = None


def reset_redis_memory() -> None:
    global _memory, _service
    _memory = None
    _service = None


def get_memory_service() -> MemoryService:
    global _service
    if _service is None:
        _service = MemoryService(get_redis_memory())
    return _service


def set_memory_service(service: MemoryService) -> None:
    global _service
    _service = service


def reset_memory_service() -> None:
    global _service
    _service = None
