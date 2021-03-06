const _ = require('lodash');
const ATTENDANCE_TYPES = ['CREATE', 'CONTRIBUTE'];

module.exports.verifyAttendanceReply = (reply) => {
  if (!_.includes(ATTENDANCE_TYPES, reply)) {
    throw new TypeError(reply + ' is not a valid attendance reply option');
  }

  return true;
};
