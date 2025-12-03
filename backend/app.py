import asyncio
import websockets
import json
from datetime import datetime
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatServer:
    def __init__(self):
        self.connected_clients = set()
        self.users = {}
        self.rooms = {'general': set(), 'help': set(), 'random': set()}
    
    async def register(self, websocket, user_data):
        user_id = user_data.get('user_id', f'user_{len(self.users)+1}')
        username = user_data.get('username', f'کاربر_{len(self.users)+1}')
        
        user_info = {
            'id': user_id,
            'username': username,
            'websocket': websocket,
            'joined_at': datetime.now().isoformat(),
            'room': 'general'
        }
        
        self.users[websocket] = user_info
        self.connected_clients.add(websocket)
        self.rooms['general'].add(websocket)
        
        logger.info(f'✅ کاربر {username} متصل شد. کل: {len(self.users)}')
        return user_info
    
    async def unregister(self, websocket):
        if websocket in self.users:
            user = self.users[websocket]
            username = user['username']
            
            if user['room'] in self.rooms and websocket in self.rooms[user['room']]:
                self.rooms[user['room']].remove(websocket)
            
            del self.users[websocket]
            
            if websocket in self.connected_clients:
                self.connected_clients.remove(websocket)
            
            logger.info(f'❌ کاربر {username} قطع شد. کل: {len(self.users)}')
    
    async def broadcast_to_room(self, room, message, exclude_websocket=None):
        if room not in self.rooms:
            return
        
        message_json = json.dumps(message, ensure_ascii=False)
        tasks = []
        
        for client in self.rooms[room]:
            if client == exclude_websocket:
                continue
            if client.open:
                tasks.append(client.send(message_json))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def handle_message(self, websocket, message):
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            if message_type == 'register':
                user = await self.register(websocket, data)
                
                await websocket.send(json.dumps({
                    'type': 'welcome',
                    'message': f'سلام {user["username"]}! به چت خوش آمدید. 👋',
                    'user_id': user['id'],
                    'username': user['username'],
                    'rooms': list(self.rooms.keys()),
                    'timestamp': datetime.now().isoformat()
                }, ensure_ascii=False))
                
                await self.broadcast_to_room('general', {
                    'type': 'user_joined',
                    'username': user['username'],
                    'timestamp': datetime.now().isoformat(),
                    'total_users': len(self.users)
                }, exclude_websocket=websocket)
            
            elif message_type == 'chat':
                if websocket in self.users:
                    user = self.users[websocket]
                    room = user['room']
                    
                    await self.broadcast_to_room(room, {
                        'type': 'message',
                        'username': user['username'],
                        'content': data.get('content', ''),
                        'room': room,
                        'timestamp': datetime.now().isoformat()
                    })
            
            elif message_type == 'join_room':
                if websocket in self.users:
                    user = self.users[websocket]
                    old_room = user['room']
                    new_room = data.get('room', 'general')
                    
                    if old_room in self.rooms and websocket in self.rooms[old_room]:
                        self.rooms[old_room].remove(websocket)
                    
                    if new_room not in self.rooms:
                        self.rooms[new_room] = set()
                    
                    self.rooms[new_room].add(websocket)
                    user['room'] = new_room
                    
                    await websocket.send(json.dumps({
                        'type': 'room_changed',
                        'room': new_room,
                        'message': f'به اتاق {new_room} پیوستید 🚪',
                        'timestamp': datetime.now().isoformat()
                    }, ensure_ascii=False))
                    
                    await self.broadcast_to_room(new_room, {
                        'type': 'user_joined_room',
                        'username': user['username'],
                        'room': new_room,
                        'timestamp': datetime.now().isoformat()
                    }, exclude_websocket=websocket)
            
            elif message_type == 'get_users':
                if websocket in self.users:
                    user = self.users[websocket]
                    room = user['room']
                    
                    room_users = []
                    for client in self.rooms.get(room, []):
                        if client in self.users:
                            room_users.append({
                                'username': self.users[client]['username'],
                                'joined_at': self.users[client]['joined_at']
                            })
                    
                    await websocket.send(json.dumps({
                        'type': 'users_list',
                        'room': room,
                        'users': room_users,
                        'timestamp': datetime.now().isoformat()
                    }, ensure_ascii=False))
            
            elif message_type == 'ping':
                await websocket.send(json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                }))
        
        except json.JSONDecodeError as e:
            logger.error(f'خطای JSON: {e}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'فرمت پیام نامعتبر است'
            }))
    
    async def handler(self, websocket, path):
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)

chat_server = ChatServer()

async def main():
    host = "0.0.0.0"
    port = int(os.getenv("PORT", "8765"))
    
    logger.info(f"🚀 سرور WebSocket روی {host}:{port} شروع شد...")
    
    async with websockets.serve(
        chat_server.handler,
        host,
        port,
        ping_interval=20,
        ping_timeout=40,
        max_size=10 * 1024 * 1024
    ):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())