# Start-WestFamilyTree.ps1

Write-Host "Starting WestFamilyTree..." -ForegroundColor Cyan

# 1. Start Python Backend
Write-Host "Starting Python Backend (Port 5005)..." -ForegroundColor Green
# Using Start-Process to open in a new window so logs are visible
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& .\.venv\Scripts\activate; python api_server_cors.py"

# 2. Start Vite Frontend
Write-Host "Starting Vite Frontend..." -ForegroundColor Green
# Using Start-Process to open in a new window
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "npm run dev"

# 3. Wait for servers to initialize
Write-Host "Waiting 5 seconds for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 4. Start Electron
Write-Host "Launching Electron..." -ForegroundColor Cyan
# This runs in the current window/process until closed, or you can spawn it too. 
# Usually keeping the main script aimed at the primary app window is fine, 
# but since Electron prints to console, let's run it directly here to see output or errors if any.
npm run electron

Write-Host "WestFamilyTree closed." -ForegroundColor Cyan
