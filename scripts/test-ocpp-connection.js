#!/usr/bin/env node

const WebSocket = require('ws');

const OCPP_SERVER_URL = process.env.OCPP_URL || 'ws://localhost:8889';
const CHARGE_POINT_ID = process.env.CHARGE_POINT_ID || 'CP_TEST_001';

console.log(`🔌 OCPP Test Client`);
console.log(`   Server: ${OCPP_SERVER_URL}`);
console.log(`   Charge Point ID: ${CHARGE_POINT_ID}\n`);

class OCPPTestClient {
    constructor() {
        this.ws = null;
        this.messageId = 0;
        this.pendingMessages = new Map();
    }

    generateMessageId() {
        return String(++this.messageId);
    }

    connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔗 Connecting to OCPP server...`);
            
            this.ws = new WebSocket(OCPP_SERVER_URL, ['ocpp1.6'], {
                headers: {
                    'Sec-WebSocket-Protocol': 'ocpp1.6'
                }
            });

            this.ws.on('open', () => {
                console.log(`✅ Connected to OCPP server`);
                console.log(`   Protocol: ${this.ws.protocol}`);
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('error', (error) => {
                console.error(`❌ WebSocket error:`, error.message);
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`🔌 Disconnected from server`);
                console.log(`   Code: ${code}`);
                console.log(`   Reason: ${reason || 'No reason provided'}`);
            });
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log(`\n📥 Received:`, JSON.stringify(message, null, 2));

            if (Array.isArray(message) && message.length >= 3) {
                const [messageTypeId, uniqueId] = message;

                if (messageTypeId === 3) { // CallResult
                    const pending = this.pendingMessages.get(uniqueId);
                    if (pending) {
                        pending.resolve(message[2]);
                        this.pendingMessages.delete(uniqueId);
                    }
                } else if (messageTypeId === 4) { // CallError
                    const pending = this.pendingMessages.get(uniqueId);
                    if (pending) {
                        pending.reject(new Error(`${message[2]}: ${message[3]}`));
                        this.pendingMessages.delete(uniqueId);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to parse message:`, error.message);
        }
    }

    sendCall(action, payload) {
        return new Promise((resolve, reject) => {
            const uniqueId = this.generateMessageId();
            const message = [2, uniqueId, action, payload];

            console.log(`\n📤 Sending ${action}:`, JSON.stringify(message, null, 2));

            this.pendingMessages.set(uniqueId, { resolve, reject });
            this.ws.send(JSON.stringify(message));

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingMessages.has(uniqueId)) {
                    this.pendingMessages.delete(uniqueId);
                    reject(new Error(`Timeout waiting for response to ${action}`));
                }
            }, 30000);
        });
    }

    async sendBootNotification() {
        console.log(`\n🚀 Sending BootNotification...`);
        
        const payload = {
            chargePointVendor: 'Test Vendor',
            chargePointModel: 'Test Model CP-001',
            chargePointSerialNumber: 'SN-TEST-001',
            chargeBoxSerialNumber: 'CBS-TEST-001',
            firmwareVersion: '1.0.0',
            iccid: '',
            imsi: '',
            meterType: 'AC',
            meterSerialNumber: 'MS-TEST-001'
        };

        try {
            const response = await this.sendCall('BootNotification', payload);
            console.log(`✅ BootNotification accepted:`, response);
            return response;
        } catch (error) {
            console.error(`❌ BootNotification failed:`, error.message);
            throw error;
        }
    }

    async sendHeartbeat() {
        console.log(`\n💓 Sending Heartbeat...`);
        
        try {
            const response = await this.sendCall('Heartbeat', {});
            console.log(`✅ Heartbeat response:`, response);
            return response;
        } catch (error) {
            console.error(`❌ Heartbeat failed:`, error.message);
            throw error;
        }
    }

    async sendStatusNotification(connectorId = 1, status = 'Available') {
        console.log(`\n📊 Sending StatusNotification...`);
        
        const payload = {
            connectorId,
            errorCode: 'NoError',
            status,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this.sendCall('StatusNotification', payload);
            console.log(`✅ StatusNotification sent for connector ${connectorId}`);
            return response;
        } catch (error) {
            console.error(`❌ StatusNotification failed:`, error.message);
            throw error;
        }
    }

    async runTestSequence() {
        try {
            // Connect
            await this.connect();

            // Send BootNotification
            await this.sendBootNotification();

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Send StatusNotification for connector 0 (charge point)
            await this.sendStatusNotification(0, 'Available');

            // Send StatusNotification for connector 1
            await this.sendStatusNotification(1, 'Available');

            // Start heartbeat loop
            console.log(`\n🔄 Starting heartbeat loop (every 30 seconds)...`);
            const heartbeatInterval = setInterval(async () => {
                try {
                    await this.sendHeartbeat();
                } catch (error) {
                    console.error(`❌ Heartbeat error:`, error.message);
                }
            }, 30000);

            // Send first heartbeat immediately
            await this.sendHeartbeat();

            // Keep connection open
            console.log(`\n✅ Test client running. Press Ctrl+C to exit.`);

            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log(`\n🛑 Shutting down...`);
                clearInterval(heartbeatInterval);
                this.ws.close();
                process.exit(0);
            });

        } catch (error) {
            console.error(`\n❌ Test sequence failed:`, error.message);
            process.exit(1);
        }
    }
}

// Run the test
const client = new OCPPTestClient();
client.runTestSequence().catch(error => {
    console.error(`❌ Fatal error:`, error);
    process.exit(1);
});