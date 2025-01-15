const dgram = require('dgram');
const os = require('os');

// Start data - TODO: move into config.json
const PORT = 12345;
const interfacesToUse = ['eno1'];
const servers = []

// Start the ollama server
const { Ollama } = require('ollama');

const getInterfaceIPs = () => {
  const interfaces = os.networkInterfaces();
  let ipAddresses = [];
  interfacesToUse.forEach(interfaceName => {
    if (interfaces[interfaceName]) {
      interfaces[interfaceName].forEach(details => {
        if (details.family === 'IPv4' && !details.internal) {
          ipAddresses.push(details.address);
        }
      });
    }
  });
  return ipAddresses;
};
const ips = getInterfaceIPs();
ips.forEach(ip => {
    servers.push(new Ollama({ host: `http://${ip}:11434` }));
    console.log(`Ollama server running on ${ip}:11434`);
});


// const { default: Ollama } = require('ollama');
// const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })

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
    console.log(`Listening for discovery requests on ${iface} (${address}), Broadcast=${broadcastAddress}`);
    const server = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
    });
    server.on('message', (msg, rinfo) => {
        console.log(`Message received: ${msg.toString()} from ${rinfo.address}:${rinfo.port}`);
        if (msg.toString() === 'ollama_discovery_request') {
            console.log(`Discovery request received on ${iface} from ${rinfo.address}`);
            const response = Buffer.from('ollama_instance_response');
            server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
                if (err) console.error(`Response error on ${iface}:`, err);
                else console.log(`Response sent to ${rinfo.address} on ${iface}`);
            });
        }
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