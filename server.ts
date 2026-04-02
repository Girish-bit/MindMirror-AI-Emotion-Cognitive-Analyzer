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

  // WebSocket Connection
  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected via WebSocket");

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "ANALYZE") {
          const { image, audio, text, mode } = data.payload;
          const result = await analyzeMultimodal(image, audio, text, mode);
          ws.send(JSON.stringify({ type: "ANALYSIS_RESULT", payload: result }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "ERROR", message: "Analysis failed" }));
      }
    });

    ws.on("close", () => console.log("Client disconnected"));
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
