////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Imports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const CertificateAdjuster = require('./сertificateAdjuster');
const cadescomMethods = require('./cadescomMethods');
const { doXmlSitnatureAlgorithm, doXmlSitnatureType } = require('./xmlSitnatureMethods');
const {
  CAPICOM: {
    CAPICOM_CURRENT_USER_STORE,
    CAPICOM_MY_STORE,
    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED,
    CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
    CAPICOM_CERTIFICATE_FIND_TIME_VALID,
    CAPICOM_CERTIFICATE_FIND_EXTENDED_PROPERTY,
    CAPICOM_PROPID_KEY_PROV_INFO,
    CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME,
    CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY,
  },
  CADESCOM: {
    CADESCOM_BASE64_TO_BINARY,
    CADESCOM_CADES_BES,
    CADESCOM_XML_SIGNATURE_TYPE_ENVELOPED,
    CADESCOM_AUTHENTICATED_ATTRIBUTE_DOCUMENT_NAME,
  },
} = require('./constants');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Functions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @async
 * @function about
 * @description выводит информацию
 */
async function about() {
  try {
    return await cadescomMethods.oAbout();
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function getCertsList
 * @throws {Error}
 * @description получает массив валидных сертификатов
 */
async function getCertsList() {
  try {
    const oStore = await cadescomMethods.oStore();
    await oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE, CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

    const certificates = await oStore.Certificates;

    if (!certificates) {
      throw new Error('Нет доступных сертификатов');
    }

    const findCertificate = await certificates.Find(CAPICOM_CERTIFICATE_FIND_TIME_VALID);
    const findCertsWithPrivateKey = await findCertificate.Find(
      CAPICOM_CERTIFICATE_FIND_EXTENDED_PROPERTY,
      CAPICOM_PROPID_KEY_PROV_INFO
    );

    const count = await findCertsWithPrivateKey.Count;

    if (!count) {
      throw new Error('Нет сертификатов с приватным ключём');
    }

    const countArray = Array(count).fill(null);

    const createCertList = await Promise.all(
      /**
       * @async
       * @function
       * @prop {Null} _ неиспользуемая величина
       * @prop {Number} index
       * Порядок элемента в массиве.
       * В функции используется index + 1, так как в cadesplugin счёт элементов ведётся с 1, а в итераторе с 0
       * @description итерируемая асинхронная функция, возвращающая массив из промисов
       */
      countArray.map(async (_, index) => {
        try {
          const certApi = await findCertsWithPrivateKey.Item(index + 1);

          const сertificateAdjuster = Object.create(CertificateAdjuster);
          сertificateAdjuster.init({
            certApi,
            issuerInfo: await certApi.IssuerName,
            privateKey: await certApi.PrivateKey,
            serialNumber: await certApi.SerialNumber,
            subjectInfo: await certApi.SubjectName,
            thumbprint: await certApi.Thumbprint,
            validPeriod: {
              from: await certApi.ValidFromDate,
              to: await certApi.ValidToDate,
            },
          });

          return сertificateAdjuster;
        } catch (error) {
          throw new Error(`При переборе сертификатов произошла ошибка: ${error.message}`);
        }
      })
    );

    oStore.Close();

    return createCertList;
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function currentCadesCert
 * @param {String} thumbprint значение сертификата
 * @throws {Error}
 * @description получает сертификат по thumbprint значению сертификата
 */
async function currentCadesCert(thumbprint) {
  try {
    if (!thumbprint) {
      throw new Error('Не указано thumbprint значение сертификата');
    } else if (typeof thumbprint !== 'string') {
      throw new Error('Не валидное значение thumbprint сертификата');
    }
    const oStore = await cadescomMethods.oStore();

    await oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE, CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

    const certificates = await oStore.Certificates;
    const count = await certificates.Count;
    const findCertificate = await certificates.Find(CAPICOM_CERTIFICATE_FIND_SHA1_HASH, thumbprint);
    if (count) {
      const certificateItem = await findCertificate.Item(1);
      oStore.Close();

      return certificateItem;
    } else {
      throw new Error(`Произошла ошибка при получении вертификата по thumbprint значению: ${thumbprint}`);
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function getCert
 * @param {String} thumbprint значение сертификата
 * @throws {Error}
 * @description
 * Получает сертификат по thumbprint значению сертификата.
 * В отличие от currentCadesCert использует для поиска коллбек функцию getCertsList
 * С помощью этой функции в сертификате доступны методы из сertificateAdjuster
 */
async function getCert(thumbprint) {
  try {
    if (!thumbprint) {
      throw new Error('Не указано thumbprint значение сертификата');
    } else if (typeof thumbprint !== 'string') {
      throw new Error('Не валидное значение thumbprint сертификата');
    }

    const certList = await getCertsList();

    for (let index = 0; index < certList.length; index++) {
      if (thumbprint === certList[index].thumbprint) {
        return await certList[index];
      }
    }

    throw new Error(`Не найдено сертификата по thumbprint значению: ${thumbprint}`);
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function signBase64
 * @param {String} thumbprint значение сертификата
 * @param {String} base64 строка в формате base64
 * @param {Boolean} type тип подписи true=откреплённая false=прикреплённая
 * @param {Number} signOption опции сертификата @default CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY
 *      0 CAPICOM_CERTIFICATE_INCLUDE_CHAIN_EXCEPT_ROOT Сохраняет все сертификаты цепочки за исключением корневого.
 *      1 CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN Сохраняет полную цепочку.
 *      2 CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY Сертификат включает только конечное лицо
 * @throws {Error}
 * @description подпись строки в формате base64
 */
async function signBase64(thumbprint, base64, type = true, signOption = CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY) {
  try {
    if (!thumbprint) {
      throw new Error('Не указано thumbprint значение сертификата');
    } else if (typeof thumbprint !== 'string') {
      throw new Error('Не валидное значение thumbprint сертификата');
    }

    const oAttrs = await cadescomMethods.oAtts();
    const oSignedData = await cadescomMethods.oSignedData();
    const oSigner = await cadescomMethods.oSigner();
    const currentCert = await currentCadesCert(thumbprint);
    const authenticatedAttributes2 = await oSigner.AuthenticatedAttributes2;

    await oAttrs.propset_Name(CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME);
    await oAttrs.propset_Value(new Date());
    await authenticatedAttributes2.Add(oAttrs);
    await oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
    await oSignedData.propset_Content(base64);
    await oSigner.propset_Certificate(currentCert);
    await oSigner.propset_Options(signOption);

    return await oSignedData.SignCades(oSigner, CADESCOM_CADES_BES, type);
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function signFile
 * @param {String} thumbprint значение сертификата
 * @param {String} base64 файл - base64
 * @param {Boolean} type тип подписи true=откреплённая false=прикреплённая
 * @param {Number} signOption опции сертификата @default CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN
 *      0 CAPICOM_CERTIFICATE_INCLUDE_CHAIN_EXCEPT_ROOT Сохраняет все сертификаты цепочки за исключением корневого.
 *      1 CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN Сохраняет полную цепочку.
 *      2 CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY Сертификат включает только конечное лицо
 * @throws {Error}
 * @description подпись строки в формате base64
 */
async function signFile(thumbprint, base64, type = true, signOption = CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN) {
    try {
      if (!thumbprint) {
        throw new Error('Не указано thumbprint значение сертификата');
      } else if (typeof thumbprint !== 'string') {
        throw new Error('Не валидное значение thumbprint сертификата');
      }

      const oDateAttrs = await cadescomMethods.oAtts();
      const oNameAttr = await cadescomMethods.oAtts();
      const oSignedData = await cadescomMethods.oSignedData();
      const oSigner = await cadescomMethods.oSigner();
      const currentCert = await currentCadesCert(thumbprint);
      const authenticatedAttributes2 = await oSigner.AuthenticatedAttributes2;

      await oDateAttrs.propset_Name(CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME);
      await oDateAttrs.propset_Value(new Date());
      await authenticatedAttributes2.Add(oDateAttrs);

      await oNameAttr.propset_Name(CADESCOM_AUTHENTICATED_ATTRIBUTE_DOCUMENT_NAME);
      await oNameAttr.propset_Value("Document Name");
      await authenticatedAttributes2.Add(oNameAttr);

      await oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
      await oSignedData.propset_Content(base64);

      await oSigner.propset_Certificate(currentCert);
      await oSigner.propset_Options(signOption);

      return await oSignedData.SignCades(oSigner, CADESCOM_CADES_BES, type);
    } catch (error) {
      throw new Error(error.message);
    }
}

/**
 * @async
 * @function verifyBase64
 * @param {String} signedMessage подпись
 * @param {String} base64 строка в формате base64
 * @throws {Error}
 * @description проверка подписи строки в формате base64
 */
async function verifyBase64(signedMessage, base64) {
  try {
    const oSignedData = await cadescomMethods.oSignedData();

    await oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
    await oSignedData.propset_Content(base64);
    await oSignedData.VerifyCades(signedMessage, CADESCOM_CADES_BES);

    return true;
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * @async
 * @function signXml
 * @param {String} thumbprint значение сертификата
 * @param {String} xml строка в формате XML
 * @param {Number} CADESCOM_XML_SIGNATURE_TYPE тип подписи 0=Вложенная 1=Оборачивающая 2=по шаблону @default 0
 * @throws {Error}
 * @description подписание XML документа
 */
async function signXml(thumbprint, xml, cadescomXmlSignatureType = CADESCOM_XML_SIGNATURE_TYPE_ENVELOPED) {
  try {
    const currentCert = await currentCadesCert(thumbprint);
    const publicKey = await currentCert.PublicKey();
    const algorithm = await publicKey.Algorithm;
    const value = await algorithm.Value;
    const oSigner = await cadescomMethods.oSigner();
    const oSignerXML = await cadescomMethods.oSignedXml();

    const { signAlgorithm, hashAlgorithm } = doXmlSitnatureAlgorithm(value);
    const xmlSitnatureType = doXmlSitnatureType(cadescomXmlSignatureType);

    await oSigner.propset_Certificate(currentCert);
    await oSignerXML.propset_Content(xml);
    await oSignerXML.propset_SignatureType(xmlSitnatureType);
    await oSignerXML.propset_SignatureMethod(signAlgorithm);
    await oSignerXML.propset_DigestMethod(hashAlgorithm);

    return await oSignerXML.Sign(oSigner);
  } catch (error) {
    throw new Error(error);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Exports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
  about,
  getCertsList,
  currentCadesCert,
  getCert,
  signXml,
  signBase64,
  signFile,
  verifyBase64,
};
