import { useEffect, useRef, useState } from 'react';

interface WebSocketHook {
  isConnected: boolean;
  lastMessage: string | null;
}

export const useWebSocket = (url: string): WebSocketHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        ws.current = new WebSocket(url);
        
        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };
        
        ws.current.onmessage = (event) => {
          console.log('WebSocket message received:', event.data);
          setLastMessage(event.data);
        };
        
        ws.current.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  return { isConnected, lastMessage };
};
