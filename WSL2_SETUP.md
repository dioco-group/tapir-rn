# WSL2 Development Setup for Expo

This guide explains how to run the Expo dev server in WSL2 and connect from an Android phone on the same network.

## The Problem

WSL2 uses a virtual network adapter with its own IP address (172.x.x.x). Your phone can't directly reach Metro running inside WSL2 - you need to forward the port through Windows.

## One-Time Setup

### 1. Get your WSL2 IP

```powershell
# In Windows PowerShell
wsl hostname -I
# Example output: 172.29.131.253 172.17.0.1
# Use the first IP (172.29.131.253)
```

### 2. Set up Port Forwarding (Run as Administrator)

```powershell
# Forward port 8081 from Windows to WSL2
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=172.29.131.253

# Add firewall rule to allow incoming connections
netsh advfirewall firewall add rule name="Expo Metro 8081" dir=in action=allow protocol=TCP localport=8081
```

### 3. Verify Port Forwarding

```powershell
# Check current port proxy rules
netsh interface portproxy show all
```

## Starting Development

### 1. Start Metro in WSL

```bash
cd /home/j/tapir-testing-fw/projects/tapir-rn
npx expo start --dev-client
```

### 2. Connect from Phone

1. Open the **Tapir Runtime** app on your Android phone
2. Tap "Enter URL manually"
3. Enter: `http://YOUR_WINDOWS_IP:8081`
   - Example: `http://192.168.1.57:8081`
4. The app should connect and load!

## Finding Your Windows IP

```powershell
# In PowerShell
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
# Usually something like 192.168.x.x
```

## Troubleshooting

### WSL2 IP Changed After Reboot

WSL2's IP can change after a reboot. Update the port forwarding:

```powershell
# Remove old rule
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0

# Get new WSL2 IP
wsl hostname -I

# Add new rule with updated IP
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=NEW_WSL_IP
```

### Quick Script (Save as `setup-expo-forward.ps1`)

```powershell
# Run as Administrator
$wslIp = (wsl hostname -I).Trim().Split(" ")[0]
Write-Host "WSL2 IP: $wslIp"

# Remove existing rule if any
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0 2>$null

# Add new rule
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$wslIp

Write-Host "Port forwarding set up. Metro will be accessible at port 8081"
netsh interface portproxy show all
```

### Phone Can't Connect

1. Make sure phone and PC are on the same WiFi network
2. Check Windows Firewall isn't blocking port 8081
3. Verify Metro is running in WSL (`curl http://localhost:8081` should respond)
4. Try disabling Windows Firewall temporarily to test

### "Android Internal Error"

This usually means the app crashed before connecting. Try:
1. Clear app data: Settings → Apps → Tapir Runtime → Clear Data
2. Reinstall the APK
3. Check for native module compatibility issues

## Using Tunnel Mode (Alternative)

If port forwarding is too complex, use Expo's tunnel mode:

```bash
cd /home/j/tapir-testing-fw/projects/tapir-rn
npx expo start --dev-client --tunnel
```

Then find the tunnel URL:
```bash
# In another terminal
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*"'
```

Enter that URL in the phone app (e.g., `https://xxxx.exp.direct`).

## Rebuilding the App

Only needed when native dependencies change:

```bash
cd /home/j/tapir-testing-fw/projects/tapir-rn
eas build --platform android --profile development
```

Download and install the new APK from the build URL.

