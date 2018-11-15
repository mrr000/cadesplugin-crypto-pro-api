////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Object create
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @description объект, в котором собираются данные о сертификате и методы по работе с этими данными
 */
const CertificateAdjuster = Object.create(null);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Methods
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @method init
 * @param {Object} currentCert
 * @description конструктор
 */
CertificateAdjuster.init = function init(currentCert) {
  const { certApi, issuerInfo, privateKey, serialNumber, thumbprint, subjectInfo, validPeriod } = currentCert;

    this.certApi = certApi;
    this.issuerInfo = issuerInfo;
    this.privateKey = privateKey;
    this.serialNumber = serialNumber;
    this.thumbprint = thumbprint;
    this.subjectInfo = subjectInfo;
    this.validPeriod = validPeriod;
}

/**
 * @method friendlyInfo
 * @param {String} subjectIssuer раздел информации 'issuerInfo' или 'subjectInfo'
 * @returns {Object}
 * @throws {Error}
 * @description возврящает объект из сформированных значений
 */
CertificateAdjuster.friendlyInfo = function friendlyInfo(subjectIssuer) {
  if (!this[subjectIssuer]) {
    throw new Error('Не верно указан аттрибут');
  }

  const { from, to } = this.validPeriod;
  const subjectIssuerArr = this[subjectIssuer].split(', ');
  const _possibleInfo = this.possibleInfo(subjectIssuer);
  const capitalize = subjectIssuer.charAt(0).toUpperCase().concat(subjectIssuer.slice(1));

  const formedSubjectIssuerInfo = subjectIssuerArr.map(tag => {
    const tagArr = tag.split('=');
    tagArr[0] = `${tagArr[0]}=`;

    return {
      text: tagArr[1],
      value: _possibleInfo[tagArr[0]],
    };
  });

  return {
    [`friendly${capitalize}`]: formedSubjectIssuerInfo,
    validPeriod: {
      from: this.friendlyDate(from),
      to: this.friendlyDate(to),
    },
  };
}

/**
 * @method friendlySubjectInfo
 * @returns {Object}
 * @description возвращает распаршенную информацию об объекте subjectInfo
 */
CertificateAdjuster.friendlySubjectInfo = function friendlySubjectInfo() {
  return this.friendlyInfo('subjectInfo');
}

/**
 * @method friendlyIssuerInfo
 * @returns {Object}
 * @description возвращает распаршенную информацию об объекте issuerInfo
 */
CertificateAdjuster.friendlyIssuerInfo = function friendlyIssuerInfo() {
  return this.friendlyInfo('issuerInfo');
}

/**
 * @method possibleInfo
 * @param {String} subjectIssuer раздел информации 'issuerInfo' или 'subjectInfo'
 * @returns {Object}
 * @throws {Error}
 * @description функция формирует ключи и значения в зависимости от переданного параметра
 */
CertificateAdjuster.possibleInfo = function possibleInfo(subjectIssuer) {
    const attrs = {
    'UnstructuredName=': 'Неструктурированное имя',
    'E=': 'Email',
    'C=': 'Страна',
    'S=': 'Регион',
    'L=': 'Город',
    'STREET=': 'Адрес',
    'O=': 'Компания',
    'T=': 'Должность',
    'ОГРНИП=': 'ОГРНИП',
    'OGRNIP=': 'ОГРНИП',
    'SNILS=': 'СНИЛС',
    'СНИЛС=': 'СНИЛС',
    'INN=': 'ИНН',
    'ИНН=': 'ИНН',
    'ОГРН=': 'ОГРН',
    'OGRN=': 'ОГРН',
  };

  switch (subjectIssuer) {
      case 'subjectInfo':
      return {
        ...attrs,
        'SN=': 'Фамилия',
        'G=': 'Имя/Отчество',
        'CN=': 'Владелец',
        'OU=': 'Отдел/подразделение',
      };
      case 'issuerInfo':
      return {
        ...attrs,
        'CN=': 'Удостоверяющий центр',
        'OU=': 'Тип',
      };
  
    default:
      throw new Error('Не верно указан кейс получаемых данных');
  }
}

/**
 * @function friendlyDate
 * @param {String} date строка с датой
 * @returns {Object}
 * @description формирует дату от переданного пареметра
 */
CertificateAdjuster.friendlyDate = function friendlyDate(date) {
  const newDate = new Date(date);
  const [day, month, year] = [newDate.getDate(), newDate.getMonth() + 1, newDate.getFullYear()];
  const [hours, minutes, seconds] = [newDate.getHours(), newDate.getMinutes(), newDate.getSeconds()];

  return {
    ddmmyy: `${day}/${month}/${year}`,
    hhmmss: `${hours}:${minutes}:${seconds}`,
  };
}

/**
 * @async
 * @method isValid
 * @returns {Boolean} возвращает валидность сертификата
 * @throws {Error} возвращает сообщение об ошибке
 * @description прозиводит проверку на валидность сертификата
 */
CertificateAdjuster.isValid = async function isValid() {
  try {
    const isValid = await this.certApi.IsValid();

    return await isValid.Result;
  } catch (error) {
    throw new Error(`Произошла ошибка при проверке валидности сертификата: ${error.message}`);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE Exports
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = CertificateAdjuster;
