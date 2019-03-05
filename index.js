////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import "./src/lib/cadesplugin_api";
import {
  getCertsList,
  getValidCertificates,
  getFirstValidCertificate,
  getCert,
  currentCadesCert,
  signBase64,
  verifyBase64,
  signXml,
  signFile,
  about,
  getSignatureInfo,
  getHash,
  signHash,
} from "./src/сertificatesApi";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE cadesplugin await function
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const cadespluginOnload = (async function cadespluginOnload() {
  try {
    await window.cadesplugin;

    return {
      getCertsList,
      getValidCertificates,
      getFirstValidCertificate,
      getCert,
      currentCadesCert,
      signBase64,
      verifyBase64,
      signXml,
      signFile,
      about,
      getSignatureInfo,
      getHash,
      signHash,
    };
  } catch (error) {
    throw new Error(error);
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Exports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default cadespluginOnload;
