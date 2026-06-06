from memory.redis_client import RedisMemory

_memory: RedisMemory | None = None


def get_redis_memory() -> RedisMemory:
    global _memory
    if _memory is None:
        _memory = RedisMemory()
    return _memory


def set_redis_memory(memory: RedisMemory) -> None:
    global _memory
    _memory = memory


def reset_redis_memory() -> None:
    global _memory
    _memory = None
