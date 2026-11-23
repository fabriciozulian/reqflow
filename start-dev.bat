@echo off
title ReqFlow - Ambiente de Desenvolvimento (Backend + React Vite)
echo ============================================================
echo Iniciando ReqFlow (API Node.js + SPA React Vite)...
echo - Backend API: http://localhost:3000
echo - Frontend Vite: http://localhost:5173
echo ============================================================

start "ReqFlow Backend (API :3000)" cmd /k "npm start"
start "ReqFlow Frontend (Vite :5173)" cmd /k "cd frontend && npm run dev"
