export async function* events(stream) {
  const decoder=new TextDecoder();let buffer='';
  for await(const chunk of stream) {
    buffer=(buffer+decoder.decode(chunk,{stream:true})).replace(/\r\n/g,'\n');
    let end;
    while((end=buffer.indexOf('\n\n'))>=0) {
      const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
      const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(data&&data!=='[DONE]')yield JSON.parse(data);
    }
  }
  buffer+=decoder.decode();
  const data=buffer.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(data&&data!=='[DONE]')yield JSON.parse(data);
}
