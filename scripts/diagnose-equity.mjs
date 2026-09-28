// Public endpoint only. No credentials or environment variables are read.
const endpoint='https://agent.bitget.com/mcp';
try {
 const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'rift-connectivity-check',version:'1'}}})});
 console.log('Company-data endpoint:',endpoint);
 console.log('Initialization HTTP:',response.status);
 console.log('Response type:',response.headers.get('content-type'));
 console.log('Session supplied:',Boolean(response.headers.get('mcp-session-id')));
 await response.body?.cancel();
 console.log('This checks initialization reachability only, not stock-data retrieval.');
} catch(error) {
 console.log('Connection error:',error.name);
 console.log('Network code:',error.cause?.code??'not supplied');
 console.log('Message:',error.message);
 process.exitCode=1;
}
