#!/bin/bash
# Deploy Alert Simulator to Ubuntu Server
# Usage: ./deploy-to-ubuntu.sh YOUR_INTEGRATION_KEY

set -e

SERVER_USER="cyclopgd"
SERVER_IP="192.168.0.179"
INTEGRATION_KEY="${1}"

if [ -z "$INTEGRATION_KEY" ]; then
    echo "❌ Error: Integration key required!"
    echo "Usage: ./deploy-to-ubuntu.sh YOUR_INTEGRATION_KEY"
    exit 1
fi

echo "🚀 Deploying Alert Simulator to Ubuntu server..."
echo "📍 Server: $SERVER_USER@$SERVER_IP"
echo ""

# Copy the alert simulator script
echo "📤 Copying alert-simulator.js..."
scp alert-simulator.js "$SERVER_USER@$SERVER_IP:/home/$SERVER_USER/"

# Create and copy the systemd service file
echo "📝 Creating systemd service..."
cat > /tmp/alert-simulator.service << EOF
[Unit]
Description=OpenAlert Alert Simulator
After=network.target

[Service]
Type=simple
User=$SERVER_USER
WorkingDirectory=/home/$SERVER_USER
Environment="OPENALERT_URL=https://openalert-api.fly.dev"
Environment="INTEGRATION_KEY=$INTEGRATION_KEY"
ExecStart=/usr/bin/node /home/$SERVER_USER/alert-simulator.js --interval=10
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

scp /tmp/alert-simulator.service "$SERVER_USER@$SERVER_IP:/tmp/"

# Install and start the service
echo "⚙️  Installing service..."
ssh "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"

# Install the service
sudo mv /tmp/alert-simulator.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable alert-simulator
sudo systemctl restart alert-simulator

echo ""
echo "✅ Service installed and started!"
echo ""
echo "📊 Check status:"
echo "   sudo systemctl status alert-simulator"
echo ""
echo "📜 View logs:"
echo "   sudo journalctl -u alert-simulator -f"
echo ""
echo "🛑 Stop service:"
echo "   sudo systemctl stop alert-simulator"
ENDSSH

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "The alert simulator is now running on your Ubuntu server."
echo "It will send test alerts every 10 minutes to OpenAlert."
echo ""
echo "To check the logs from your Windows machine:"
echo "  ssh $SERVER_USER@$SERVER_IP sudo journalctl -u alert-simulator -f"
