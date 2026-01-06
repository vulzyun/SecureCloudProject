import asyncio
from .events import bus

async def run_fake(run_id: int):
    async def step(name: str, delay: float = 0.4):
        await bus.publish(run_id, {"type": "step_start", "step": name})
        await asyncio.sleep(delay)
        await bus.publish(run_id, {"type": "log", "step": name, "line": f"[{name}] ok\n"})
        await bus.publish(run_id, {"type": "step_success", "step": name})

    await bus.publish(run_id, {"type": "run_start"})
    for s in ["clone", "tests", "sonar", "docker_build", "docker_push", "deploy", "healthcheck"]:
        await step(s)
    await bus.publish(run_id, {"type": "run_success"})
