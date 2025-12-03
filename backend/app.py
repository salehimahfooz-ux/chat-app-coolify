import asyncio
import websockets
import json

connected = set()

async def handler(websocket, path):
    connected.add(websocket)
    print(f"✅ New connection. Total: {len(connected)}")
    
    try:
        # ارسال خوش‌آمدگویی اولیه
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "سلام! به چت سرور وصل شدی. 👋",
            "timestamp": "همین الان"
        }, ensure_ascii=False))
        
        # گوش دادن به پیام‌ها
        async for message in websocket:
            try:
                data = json.loads(message)
                print(f"📨 Received: {data}")
                
                if data.get("type") == "register":
                    username = data.get("username", "کاربر")
                    user_id = f"user_{len(connected)}"
                    
                    # پاسخ به ثبت نام
                    await websocket.send(json.dumps({
                        "type": "user_info",
                        "user_id": user_id,
                        "username": username,
                        "message": f"ثبت نام موفق! خوش آمدی {username}",
                        "timestamp": "همین الان"
                    }, ensure_ascii=False))
                    
                    print(f"👤 User registered: {username}")
                
                elif data.get("type") == "chat":
                    # بازگرداندن پیام به کاربر
                    await websocket.send(json.dumps({
                        "type": "message",
                        "username": "شما",
                        "content": data.get("content", ""),
                        "timestamp": "همین الان"
                    }, ensure_ascii=False))
                    
                    print(f"💬 Chat message: {data.get('content', '')}")
                
                elif data.get("type") == "ping":
                    # پاسخ به ping
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": "همین الان"
                    }))
                    
                    print("🏓 Ping received")
            
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "پیام نامعتبر. لطفاً JSON معتبر ارسال کنید."
                }))
    
    except websockets.exceptions.ConnectionClosed:
        print("❌ Connection closed by client")
    
    finally:
        connected.remove(websocket)
        print(f"👋 Connection removed. Total: {len(connected)}")

async def main():
    print("🚀 Starting WebSocket server on port 8765...")
    
    async with websockets.serve(
        handler,
        "0.0.0.0",
        8765,
        ping_interval=30,
        ping_timeout=60,
        max_size=10 * 1024 * 1024  # 10MB
    ):
        print("✅ WebSocket server is ready!")
        print("📡 Listening on ws://0.0.0.0:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
