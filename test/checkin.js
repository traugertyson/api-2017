const _Promise = require('bluebird');

const chai = require('chai');
const sinon = require('sinon');
const _ = require('lodash');

const errors = require('../api/v1/errors');
const utils = require('../api/v1/utils');
const User = require('../api/v1/models/User.js');
const CheckInService = require('../api/v1/services/CheckInService.js');
const CheckIn = require('../api/v1/models/CheckIn.js');

const assert = chai.assert;
const expect = chai.expect;
const tracker = require('mock-knex').getTracker();


describe('CheckInService', () => {
  describe('findCheckInByUserId', () => {

    let testUser;
    let noCheckinTestUser;
    let testCheckIn;
    let _findByUserId;

    before((done) => {
      testUser = User.forge({id: 1, email: 'test@exmple.com' });
      testUser.related('roles').add({ role: utils.roles.ATTENDEE });

      noCheckinTestUser = User.forge({id: 2, email: 'nullTest@exmple.com' });
      noCheckinTestUser.related('roles').add({ role: utils.roles.ATTENDEE });

      testCheckIn = CheckIn.forge({ id: 1, user_id: testUser.id, location: 'ECEB', swag: false});

      _findByUserId = sinon.spy(CheckIn, 'findByUserId');

      tracker.install();

      tracker.on('query', (query) => {
        if (query.bindings[0] == testUser.id) {
          query.response([ testCheckIn ]);
        } else {
          query.response([]);
        }
      });

      done();
    });

    it('finds a CheckIn using valid user id', (done) => {
      const checkin = CheckInService.findCheckInByUserId(testUser.id);
      checkin.then((response) => {
        expect(response).to.have.deep.property('checkin.attributes.id', testCheckIn.id);
        assert(_findByUserId.calledOnce, 'CheckIn findByUserId not called once');
        done();
      });
    });

    it('throws error for requesting a CheckIn for non-existent user', (done) => {
      const checkin = CheckInService.findCheckInByUserId(noCheckinTestUser.id);
      checkin.catch((error) => {
        expect(error).to.be.an.instanceof(errors.NotFoundError);
        assert(_findByUserId.calledOnce, 'CheckIn findByUserId not called once');
        done();
      });
    });

    afterEach((done) => {
      _findByUserId.reset();
      done();
    });

    after((done) => {
      tracker.uninstall();
      _findByUserId.restore();
      done();
    });
  });

  describe('updateCheckIn', () => {

    let testCheckIn;
    let testAttendeeCheckIn;
    let _save;
    let _findByUserId;
    let _get;

    before((done) => {
      testCheckIn = {
        'userId': 2342,
        'location': 'DCL',
        'swag': true,
        'credentialsRequested': false
      };

      _findByUserId = sinon.stub(CheckIn, 'findByUserId');

      _get = sinon.stub(CheckIn.prototype, 'get');
      _get.withArgs('userId').returns(testCheckIn['userId']);
      _get.withArgs('location').returns(testCheckIn['location']);
      _get.withArgs('swag').returns(testCheckIn['swag']);
      _save = sinon.stub(CheckIn.prototype, 'save', function() {
        return _Promise.resolve(this);
      });

      done();
    });

    it('updates status of CheckIn variables when changing swag from false to true', (done) => {
      testAttendeeCheckIn = CheckIn.forge(testCheckIn);
      _findByUserId.withArgs(2342).returns(_Promise.resolve(testAttendeeCheckIn));
      testCheckIn.location = 'SIEBEL';
      testCheckIn.swag = true;

      CheckInService.updateCheckIn(testCheckIn)
                .then((checkin) => {
                  expect(checkin).to.have.deep.property('checkin.attributes.location', 'SIEBEL');
                  expect(checkin).to.have.deep.property('checkin.attributes.swag', true);
                  done();
                });
    });
    it('cannot change swag from true to false', (done) => {
      testAttendeeCheckIn = CheckIn.forge(testCheckIn);
      _get.withArgs('swag').returns(testCheckIn['swag']);
      _findByUserId.withArgs(2342).returns(_Promise.resolve(testAttendeeCheckIn));
      testCheckIn.userId = 2342;
      testCheckIn.swag = false;

      CheckInService.updateCheckIn(testCheckIn)
                .then((checkin) => {
                  expect(checkin).to.have.deep.property('checkin.attributes.location', 'SIEBEL');
                  expect(checkin).to.have.deep.property('checkin.attributes.swag', true);
                  done();
                });
    });
    after((done) => {
      _get.restore();
      _findByUserId.restore();
      _save.restore();
      done();
    });
  });

  describe('createCheckIn', () => {

    let testCheckIn;
    let _saveCheckin;

    before((done) => {
      testCheckIn = {
        'userId': 1,
        'location': 'DCL',
        'swag': false,
        'credentialsRequested': false
      };

      _saveCheckin = sinon.spy(CheckIn.prototype, 'save');

      done();
    });
    beforeEach((done) => {
      tracker.install();
      done();
    });
    it('creates a valid CheckIn', function(done) {
      const testCheckInClone = _.clone(testCheckIn);
      tracker.on('query', (query) => {
        query.response([]);
      });

      const checkin = CheckInService.createCheckIn(testCheckInClone);

      checkin.bind(this).then(() => {
        assert(_saveCheckin.calledOnce, 'Checkin forge not called');
        done();
      });
    });

    it('fails when user already has CheckIn', (done) => {
      const testCheckInClone = _.clone(testCheckIn);

      tracker.on('query', (query) => {
        const err = new Error();
        err.code = errors.Constants.DupEntry;
        query.reject(err);
      });

      const checkin = CheckInService.createCheckIn(testCheckInClone);
      expect(checkin).to.eventually.be.rejectedWith(errors.InvalidParameterError).and.notify(done);
    });

    afterEach((done) => {
      tracker.uninstall();
      done();
    });

    after((done) => {
      _saveCheckin.restore();
      done();
    });
  });
});
