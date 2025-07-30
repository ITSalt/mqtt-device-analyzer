# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Application
```bash
# Standard start
npm start

# Development mode with auto-reload
npm run dev

# Production deployment with PM2
npm run pm2:start

# Development mode with PM2 (SSL disabled)
npm run pm2:start:dev
```

### SSL Certificate Management
```bash
# Generate SSL certificates
npm run certs:generate

# Regenerate certificates (removes old ones)
npm run certs:recreate  

# Check SSL certificate validity
npm run certs:check

# Generate with custom domain
MQTT_DOMAIN=mqtt.yourdomain.com npm run certs:generate
```

### Testing and Diagnostics
```bash
# Test all protocol connections
npm run test:connections

# Health check endpoint
npm run health

# View PM2 logs
npm run pm2:logs

# Monitor PM2 processes
npm run pm2:monit
```

### Log Management
```bash
# Clean all log files
npm run logs:clean

# Backup logs with timestamp
npm run logs:backup
```

## High-Level Architecture

### Core Components

1. **mqtt-broker.js** - Main entry point that:
   - Initializes Aedes MQTT broker
   - Sets up transport manager for multi-protocol support
   - Handles client connections and message routing
   - Implements pattern analysis for reverse engineering

2. **transport-manager.js** - Manages all protocol transports:
   - Dynamically loads enabled transports based on config
   - Coordinates MQTT, MQTTS, WebSocket, and WSS protocols
   - Emits events for client connections across all transports
   - Handles graceful shutdown of all services

3. **transports/** - Protocol implementations:
   - **base-transport.js**: Abstract base class for all transports
   - **mqtt-transport.js**: Standard MQTT over TCP (port 1883)
   - **mqtts-transport.js**: MQTT over TLS/SSL (port 8883)
   - **ws-transport.js**: MQTT over WebSocket (port 8887)
   - **wss-transport.js**: MQTT over Secure WebSocket (port 8888)

4. **pattern-analyzer.js** - IoT device analysis:
   - Detects message patterns and formats (JSON, binary, hex)
   - Extracts device fingerprints and behavioral patterns
   - Saves raw payloads for manual reverse engineering

5. **config.js** - Centralized configuration:
   - Environment variable management with defaults
   - Protocol enable/disable flags
   - SSL certificate paths and settings
   - Port assignments for all protocols

### Data Flow

1. IoT devices connect via any supported protocol
2. Transport manager routes connections to Aedes broker
3. Messages are intercepted and analyzed for patterns
4. All data is logged with protocol context
5. Health check service monitors all transports

### Key Design Patterns

- **Event-driven architecture**: All components communicate via EventEmitter
- **Transport abstraction**: Base class ensures consistent behavior across protocols
- **Graceful degradation**: Individual transports can fail without affecting others
- **Comprehensive logging**: Separate logs for connections, messages, errors, and analysis

## Important Notes

- This is a security analysis tool for reverse engineering IoT devices
- All protocols can be individually enabled/disabled via environment variables
- SSL certificates are auto-generated for localhost by default
- PM2 is used for production deployment with automatic restarts
- Logs are structured by type in mqtt_logs/ directory