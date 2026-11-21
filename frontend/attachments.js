async function __agyPrepareAttachments(message) {
  if(!window.ohMyChannels||!message.media?.length)return message;
  const media=message.media.map(item=>{
    const value={uri:item.uri,displayName:item.displayName,mimeType:item.mimeType};
    const bytes=item.payload?.case==='inlineData'?item.payload.value:null;
    if(!item.uri&&bytes?.length){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));value.data=btoa(text);}
    return value;
  });
  const {paths}=await window.ohMyChannels.request({action:'attachments',cascadeId:message.cascadeId,media});
  return {...message,media:[],items:[...(message.items??[]),...paths.map(value=>({chunk:{case:'text',value}}))]};
}
