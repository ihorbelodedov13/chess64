#!/bin/bash
# Start backend and frontend in parallel

echo "=== Starting Chess App ==="

# Kill any existing processes on port 8000 and 5173
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start backend
echo "[Backend] Starting FastAPI on http://localhost:8000 ..."
(cd backend && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "[Frontend] Starting Vite on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
