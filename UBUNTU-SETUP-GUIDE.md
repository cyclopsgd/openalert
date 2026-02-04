# Ubuntu Server Setup for Alert Simulator

## Quick Setup (5 minutes)

### Step 1: Copy the script to your Ubuntu server

```bash
# On your Windows machine, use scp or just copy-paste
scp alert-simulator.js your-user@your-server:/home/your-user/
```

Or just copy-paste the contents into a new file on the server:
```bash
nano ~/alert-simulator.js
# Paste the content, then Ctrl+X, Y, Enter
```

### Step 2: Make sure Node.js is installed

```bash
# Check if Node.js is installed
node --version

# If not installed, install it
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Run it once to test

```bash
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --once
```

### Step 4: Set it up as a systemd service (runs forever)

Create the service file:
```bash
sudo nano /etc/systemd/system/alert-simulator.service
```

Paste this content:
```ini
[Unit]
Description=OpenAlert Alert Simulator
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME
Environment="OPENALERT_URL=https://openalert-api.fly.dev"
Environment="INTEGRATION_KEY=YOUR_INTEGRATION_KEY_HERE"
ExecStart=/usr/bin/node /home/YOUR_USERNAME/alert-simulator.js --interval=10
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

Replace:
- `YOUR_USERNAME` with your actual username (run `whoami` to find out)
- `YOUR_INTEGRATION_KEY_HERE` with your actual integration key

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable alert-simulator
sudo systemctl start alert-simulator
```

### Step 5: Check it's working

```bash
# View live logs
sudo journalctl -u alert-simulator -f

# Check status
sudo systemctl status alert-simulator

# Stop it
sudo systemctl stop alert-simulator

# Restart it
sudo systemctl restart alert-simulator
```

## Alternative: Run with tmux (simpler but doesn't auto-restart)

```bash
# Install tmux if not already installed
sudo apt-get install tmux

# Start a tmux session
tmux new -s alerts

# Run the simulator
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --interval=10

# Detach from tmux: Press Ctrl+B, then D

# Reattach later
tmux attach -t alerts
```

## Changing the interval

Edit the service file:
```bash
sudo nano /etc/systemd/system/alert-simulator.service
```

Change `--interval=10` to whatever you want (in minutes), then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart alert-simulator
```

## Stopping the simulator

```bash
sudo systemctl stop alert-simulator
sudo systemctl disable alert-simulator
```

That's it! Super easy! 🎉
