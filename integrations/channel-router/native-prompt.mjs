// The native client can retroactively append these UI notices to old turns.
// Model routing already carries this selection; it is not conversation content.
const modelSelectionNotice=/\r?\n<USER_SETTINGS_CHANGE>\r?\nThe user changed setting `Model Selection` from [^\r\n]+\. No need to comment on this change if the user doesn't ask about it\. If reporting what model you are, please use a human readable name instead of the exact string\.\r?\n<\/USER_SETTINGS_CHANGE>\s*$/;

export function nativeUserText(text) {
  let previous;
  do{previous=text;text=text.replace(modelSelectionNotice,'');}while(previous!==text);
  return text;
}
