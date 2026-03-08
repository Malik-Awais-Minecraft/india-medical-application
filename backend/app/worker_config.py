from redis import Redis
from rq import Queue
import os

# Optional usage for standard RQ configurations if using pure Redis. 
# It expects a local redis server to be running on default port.
# However, if docker/redis isn't setup locally during MVP testing, it will fail to connect.
# We'll set it up defensively.

try:
    redis_conn = Redis(host='localhost', port=6379)
    # Check connection
    redis_conn.ping()
    task_queue = Queue('document_tasks', connection=redis_conn)
except Exception as e:
    print(f"Warning: Redis not connected. {e}")
    task_queue = None
