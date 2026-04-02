import express from "express";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { createServer as createViteServer } from "vite";
import { analyzeMultimodal } from "./src/services/aiService";

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // WebSocket Connection for Real-Time Streaming
  wss.on("connection", (ws: WebSocket) => {
    console.log("DEBUG: High-performance stream established");

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === "STREAM_FRAME") {
          const { image, audio, text, mode, sessionId } = data.payload;
          
          // Process frame with Gemini
          const result = await analyzeMultimodal(image, audio, text, mode);
          
          // Send back to client with original timestamp for latency tracking
          ws.send(JSON.stringify({ 
            type: "STREAM_RESULT", 
            payload: result,
            timestamp: data.timestamp 
          }));
        }
      } catch (error) {
        console.error("DEBUG: Stream processing error:", error);
        ws.send(JSON.stringify({ 
          type: "STREAM_ERROR", 
          message: error instanceof Error ? error.message : "Stream processing failed" 
        }));
      }
    });

    ws.on("close", () => console.log("DEBUG: Stream disconnected"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
