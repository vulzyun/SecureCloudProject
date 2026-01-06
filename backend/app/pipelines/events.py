import asyncio
from collections import defaultdict

class RunEventBus:
    def __init__(self):
        self._queues = defaultdict(asyncio.Queue)

    def queue(self, run_id: int) -> asyncio.Queue:
        return self._queues[run_id]

    async def publish(self, run_id: int, event: dict):
        await self._queues[run_id].put(event)

bus = RunEventBus()
