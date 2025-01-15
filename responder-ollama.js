const dgram = require('dgram');
const os = require('os');
const config = require("./config")

const PORT = config.multicastPort;
const interfacesToUse = config.interfaces;

// Start the ollama server
const { spawn } = require('child_process');
const ollamaServer = spawn('./serve.sh');
ollamaServer.on('close', (code) => {
    console.log(`WARNING: Ollama exited with code ${code}`);
    process.exit(code);
});

// Store agent functions that can be called through multicast
const multicastFunctions = {
    "ollama_discovery_request": (rinfo, iface) => {
        console.log(`Discovery request received on ${iface} from ${rinfo.address}`);
        return config.ollamaPort
    }
}

// Start the multicast responder
interfacesToUse.forEach((iface) => {
    const netInterfaces = os.networkInterfaces();
    const ifaceInfo = netInterfaces[iface]?.find((info) => info.family === 'IPv4' && !info.internal);
    if (!ifaceInfo) {
        console.error(`Interface ${iface} not found or doesn't have an IPv4 address.`);
        return;
    }
    const { address, netmask } = ifaceInfo;
    const broadcastAddress = calculateBroadcastAddress(address, netmask);
    console.log(`Listening for multicast requests on ${iface} (${address}), Broadcast=${broadcastAddress}`);
    const server = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
    });
    server.on('message', (msg, rinfo) => {
        console.log(`Message received: ${msg.toString()} from ${rinfo.address}:${rinfo.port}`);
        const response = multicastFunctions[msg.toString()]?.(rinfo, iface) || "pong";
        const responseBuffer = Buffer.from(String(response));
        server.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err) => {
            if (err) console.error(`Response error on ${iface}:`, err);
            else console.log(`Response sent to ${rinfo.address} on ${iface}`);
        });
    });
    server.on('error', (err) => {
        console.error(`Server error on ${iface}:`, err);
        server.close();
    });
    // Bind to all available interfaces (0.0.0.0) instead of a specific address
    server.bind(PORT, '0.0.0.0', () => {
        console.log(`Bound to 0.0.0.0:${PORT} on ${iface}`);
        server.setBroadcast(true);
        
        // Add some diagnostic logging
        server.on('listening', () => {
            const address = server.address();
            console.log(`Server listening on ${address.address}:${address.port}`);
        });
    });
});
function calculateBroadcastAddress(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const netmaskParts = netmask.split('.').map(Number);
    const broadcastParts = ipParts.map((part, i) => part | (~netmaskParts[i] & 0xff));
    return broadcastParts.join('.');
}