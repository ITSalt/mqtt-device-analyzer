const BaseTransport = require('./base-transport');
const { WebSocket, WebSocketServer } = require('ws');

class OCPPTransport extends BaseTransport {
    constructor(port, config) {
        super('OCPP', port, config);
        this.server = null;
        this.clients = new Map();
        this.messageTypeIds = {
            CALL: 2,
            CALLRESULT: 3,
            CALLERROR: 4
        };
        this.actions = {
            BOOT_NOTIFICATION: 'BootNotification',
            HEARTBEAT: 'Heartbeat',
            STATUS_NOTIFICATION: 'StatusNotification',
            AUTHORIZE: 'Authorize',
            START_TRANSACTION: 'StartTransaction',
            STOP_TRANSACTION: 'StopTransaction',
            METER_VALUES: 'MeterValues'
        };
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = new WebSocketServer({
                    port: this.port,
                    handleProtocols: (protocols) => {
                        if (protocols.has('ocpp1.6')) {
                            return 'ocpp1.6';
                        }
                        return false;
                    }
                });

                this.server.on('connection', (ws, req) => {
                    this.handleConnection(ws, req);
                });

                this.server.on('error', (error) => {
                    console.error(`[${this.name}] Server error:`, error);
                    this.emit('error', error);
                });

                this.server.on('listening', () => {
                    this.isRunning = true;
                    console.info(`[${this.name}] Transport started on port ${this.port}`);
                    resolve();
                });

                console.info(`[${this.name}] Starting transport on port ${this.port}...`);
            } catch (error) {
                console.error(`[${this.name}] Failed to start transport:`, error);
                reject(error);
            }
        });
    }

    handleConnection(ws, req) {
        const clientIp = req.socket.remoteAddress;
        const clientId = this.generateClientId();
        
        console.info(`[${this.name}] New OCPP client connected from ${clientIp}, assigned ID: ${clientId}`);
        
        const client = {
            id: clientId,
            ws: ws,
            ip: clientIp,
            connectedAt: new Date(),
            bootNotificationData: null,
            isAccepted: false
        };
        
        this.clients.set(clientId, client);
        this.connectionCount++;
        
        this.emit('clientConnected', {
            clientId,
            protocol: 'OCPP',
            address: clientIp,
            transport: this.name
        });

        ws.on('message', (data) => {
            this.handleMessage(client, data);
        });

        ws.on('close', () => {
            console.info(`[${this.name}] Client ${clientId} disconnected`);
            this.clients.delete(clientId);
            this.emit('clientDisconnected', {
                clientId,
                protocol: 'OCPP',
                address: clientIp,
                transport: this.name
            });
        });

        ws.on('error', (error) => {
            console.error(`[${this.name}] Client ${clientId} error:`, error);
            this.emit('error', { clientId, error });
        });

        ws.on('pong', () => {
            client.isAlive = true;
        });
    }

    handleMessage(client, data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (!Array.isArray(message) || message.length < 3) {
                throw new Error('Invalid OCPP message format');
            }

            const [messageTypeId, uniqueId, ...rest] = message;

            if (messageTypeId === this.messageTypeIds.CALL) {
                const [action, payload] = rest;
                this.handleCall(client, uniqueId, action, payload);
            } else if (messageTypeId === this.messageTypeIds.CALLRESULT) {
                const [payload] = rest;
                this.handleCallResult(client, uniqueId, payload);
            } else if (messageTypeId === this.messageTypeIds.CALLERROR) {
                const [errorCode, errorDescription, errorDetails] = rest;
                this.handleCallError(client, uniqueId, errorCode, errorDescription, errorDetails);
            }

            this.emit('messageReceived', {
                clientId: client.id,
                messageType: this.getMessageTypeName(messageTypeId),
                action: messageTypeId === this.messageTypeIds.CALL ? rest[0] : null,
                uniqueId,
                payload: rest[rest.length - 1],
                protocol: 'OCPP',
                transport: this.name
            });

        } catch (error) {
            console.error(`[${this.name}] Failed to parse OCPP message from client ${client.id}:`, error);
            this.sendError(client, 'Unknown', 'ProtocolError', 'Invalid message format', {});
        }
    }

    handleCall(client, uniqueId, action, payload) {
        console.info(`[${this.name}] Received ${action} from client ${client.id}`);

        switch (action) {
            case this.actions.BOOT_NOTIFICATION:
                this.handleBootNotification(client, uniqueId, payload);
                break;
            case this.actions.HEARTBEAT:
                this.handleHeartbeat(client, uniqueId);
                break;
            case this.actions.STATUS_NOTIFICATION:
                this.handleStatusNotification(client, uniqueId, payload);
                break;
            case this.actions.AUTHORIZE:
                this.handleAuthorize(client, uniqueId, payload);
                break;
            case this.actions.START_TRANSACTION:
                this.handleStartTransaction(client, uniqueId, payload);
                break;
            case this.actions.STOP_TRANSACTION:
                this.handleStopTransaction(client, uniqueId, payload);
                break;
            case this.actions.METER_VALUES:
                this.handleMeterValues(client, uniqueId, payload);
                break;
            default:
                console.warn(`[${this.name}] Unknown action: ${action}`);
                this.sendError(client, uniqueId, 'NotImplemented', `Action ${action} not implemented`, {});
        }
    }

    handleBootNotification(client, uniqueId, payload) {
        client.bootNotificationData = payload;
        client.isAccepted = true;
        
        const response = {
            status: 'Accepted',
            currentTime: new Date().toISOString(),
            interval: 300
        };
        
        this.sendResponse(client, uniqueId, response);
        
        this.emit('bootNotification', {
            clientId: client.id,
            chargePointVendor: payload.chargePointVendor,
            chargePointModel: payload.chargePointModel,
            chargePointSerialNumber: payload.chargePointSerialNumber,
            firmwareVersion: payload.firmwareVersion
        });
    }

    handleHeartbeat(client, uniqueId) {
        const response = {
            currentTime: new Date().toISOString()
        };
        this.sendResponse(client, uniqueId, response);
    }

    handleStatusNotification(client, uniqueId, payload) {
        const response = {};
        this.sendResponse(client, uniqueId, response);
        
        this.emit('statusNotification', {
            clientId: client.id,
            connectorId: payload.connectorId,
            status: payload.status,
            errorCode: payload.errorCode,
            info: payload.info,
            timestamp: payload.timestamp
        });
    }

    handleAuthorize(client, uniqueId, payload) {
        const response = {
            idTagInfo: {
                status: 'Accepted',
                expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
        };
        this.sendResponse(client, uniqueId, response);
    }

    handleStartTransaction(client, uniqueId, payload) {
        const transactionId = Math.floor(Math.random() * 1000000);
        const response = {
            transactionId,
            idTagInfo: {
                status: 'Accepted'
            }
        };
        this.sendResponse(client, uniqueId, response);
        
        this.emit('transactionStarted', {
            clientId: client.id,
            transactionId,
            connectorId: payload.connectorId,
            idTag: payload.idTag,
            meterStart: payload.meterStart,
            timestamp: payload.timestamp
        });
    }

    handleStopTransaction(client, uniqueId, payload) {
        const response = {
            idTagInfo: {
                status: 'Accepted'
            }
        };
        this.sendResponse(client, uniqueId, response);
        
        this.emit('transactionStopped', {
            clientId: client.id,
            transactionId: payload.transactionId,
            meterStop: payload.meterStop,
            timestamp: payload.timestamp,
            reason: payload.reason
        });
    }

    handleMeterValues(client, uniqueId, payload) {
        const response = {};
        this.sendResponse(client, uniqueId, response);
        
        this.emit('meterValues', {
            clientId: client.id,
            connectorId: payload.connectorId,
            transactionId: payload.transactionId,
            meterValue: payload.meterValue
        });
    }

    handleCallResult(client, uniqueId, payload) {
        console.debug(`[${this.name}] Received CallResult from client ${client.id} for message ${uniqueId}`);
    }

    handleCallError(client, uniqueId, errorCode, errorDescription, errorDetails) {
        console.error(`[${this.name}] Received CallError from client ${client.id}: ${errorCode} - ${errorDescription}`);
    }

    sendResponse(client, uniqueId, payload) {
        const message = [this.messageTypeIds.CALLRESULT, uniqueId, payload];
        this.sendMessage(client, message);
    }

    sendError(client, uniqueId, errorCode, errorDescription, errorDetails) {
        const message = [this.messageTypeIds.CALLERROR, uniqueId, errorCode, errorDescription, errorDetails];
        this.sendMessage(client, message);
    }

    sendMessage(client, message) {
        try {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            } else {
                console.warn(`[${this.name}] Cannot send message to client ${client.id}: WebSocket not open`);
            }
        } catch (error) {
            console.error(`[${this.name}] Failed to send message to client ${client.id}:`, error);
        }
    }

    generateClientId() {
        return `ocpp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getMessageTypeName(messageTypeId) {
        switch (messageTypeId) {
            case this.messageTypeIds.CALL:
                return 'Call';
            case this.messageTypeIds.CALLRESULT:
                return 'CallResult';
            case this.messageTypeIds.CALLERROR:
                return 'CallError';
            default:
                return 'Unknown';
        }
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            console.info(`[${this.name}] Stopping transport...`);

            for (const [clientId, client] of this.clients) {
                client.ws.close();
            }
            this.clients.clear();

            this.server.close(() => {
                this.isRunning = false;
                console.info(`[${this.name}] Transport stopped`);
                resolve();
            });
        });
    }

    getStats() {
        const stats = super.getStats();
        stats.activeClients = this.clients.size;
        stats.acceptedClients = Array.from(this.clients.values()).filter(c => c.isAccepted).length;
        return stats;
    }

    async checkHealth() {
        const baseHealth = await super.checkHealth();
        return {
            ...baseHealth,
            activeClients: this.clients.size,
            serverListening: this.server && this.server.listening
        };
    }
}

module.exports = OCPPTransport;