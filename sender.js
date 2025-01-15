const dgram = require('dgram');
const os = require('os');
const { Ollama } = require('ollama');
const fs = require("fs");

const INTERFACES = ['eth0'];
const BROADCAST_PORT = 12345;

// Function to get IP and broadcast address for specified interfaces
function getInterfaceDetails(interfaceName) {
    const interfaces = os.networkInterfaces();
    const iface = interfaces[interfaceName];
    if (!iface) {
        throw new Error(`Interface ${interfaceName} not found`);
    }
    const ipv4 = iface.find((info) => info.family === 'IPv4' && !info.internal);
    if (!ipv4) {
        throw new Error(`IPv4 address not found on interface ${interfaceName}`);
    }
    const ipParts = ipv4.address.split('.').map(Number);
    const maskParts = ipv4.netmask.split('.').map(Number);
    const broadcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 0xff));
    return {
        localIP: ipv4.address,
        broadcastIP: broadcastParts.join('.'),
    };
}

// Generic discovery function
async function multicastRequest(message, waitTimeMs) {
    const results = [];

    const promises = INTERFACES.map((iface) =>
        new Promise((resolve, reject) => {
            try {
                const { localIP, broadcastIP } = getInterfaceDetails(iface);
                console.log(`Using ${iface}: IP=${localIP}, Broadcast=${broadcastIP}`);

                const server = dgram.createSocket('udp4');
                const discovered = [];

                server.bind(BROADCAST_PORT, localIP, () => {
                    server.setBroadcast(true);
                    console.log(`Bound to ${iface} (${localIP})`);

                    const bufferMessage = Buffer.from(message);
                    server.send(bufferMessage, 0, bufferMessage.length, BROADCAST_PORT, broadcastIP, (err) => {
                        if (err) {
                            console.error(`Broadcast error on ${iface}:`, err);
                            reject(err);
                        } else {
                            console.log(`Broadcast message sent on ${iface}`);
                        }
                    });
                });

                // Collect responses
                server.on('message', (msg, rinfo) => {
                    console.log(`Response from ${rinfo.address}:${rinfo.port} -> ${msg.toString()}`);
                    discovered.push({ ip: rinfo.address, port: rinfo.port, data: msg.toString() });
                });

                // Close the server after the wait time
                setTimeout(() => {
                    server.close(() => {
                        console.log(`Stopped listening on ${iface}`);
                        resolve(discovered);
                    });
                }, waitTimeMs);
            } catch (error) {
                console.error(`Error on ${iface}:`, error.message);
                reject(error);
            }
        })
    );

    // Await all interface discoveries and merge results
    const allResults = await Promise.all(promises);
    allResults.forEach((result) => results.push(...result));
    return results;
}

// Usage example
(async () => {

    let ollamaInstances = [];

    const message = 'ollama_discovery_request';
    const waitTimeMs = 500; // 5 seconds
    const responses = await multicastRequest(message, waitTimeMs);
    responses.forEach(server => {
        ollamaInstances.push(new Ollama({ host: `http://${server.ip}:${server.data}` }))
    })
    console.log('Discovered servers:', ollamaInstances);

    const context = [];
    context.push({"role": "system", "content": fs.readFileSync("./system.prompt").toString()})
    context.push({"role": "user", "content": "Hello!"})

    const response = await ollamaInstances[0].chat({
        model: 'qwen2.5:7b',
        messages: context,
    })

    console.log(response)

})();
