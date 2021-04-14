
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/
  let Airline1 = accounts[1];
  let Airline2 = accounts[2];
  let Airline3 = accounts[3];
  let Airline4 = accounts[4];
  let Airline5 = accounts[5];
  let passenger = accounts[6];
  it(`Contracts have correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
    let status2 = await config.flightSuretyApp.isOperational.call();
    assert.equal(status2, true, "Incorrect initial operating status value");
  });

  it('Contracts can block access to setOperatingStatus() for non-Contract Owner account', async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
            assert.equal(e['reason'],'Caller is not contract owner','wrong error detected')
            accessDenied = true;
      }
      assert.equal(accessDenied, true, "(flightSuretyData) Access not restricted to Contract Owner");
      accessDenied = false;
      try 
      {
          await config.flightSuretyApp.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
            assert.equal(e['reason'],'Caller is not contract owner','wrong error detected')
            accessDenied = true;
      }
      assert.equal(accessDenied, true, "(flightSuretyApp) Access not restricted to Contract Owner");      
  });

  it('Contracts can allow access to setOperatingStatus() for Contract Owner account', async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "(flightSuretyData)Access not restricted to Contract Owner");
      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

      accessDenied = false;
      try 
      {
          await config.flightSuretyApp.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "(flightSuretyApp)Access not restricted to Contract Owner");
      // Set it back for other tests to work
      await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('Contracts can block access to functions using requireIsOperational when operating status is false', async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
        await config.flightSuretyData.testing_mode();
      }
      catch(e) {
        assert.equal(e['reason'],'Contract is currently not operational','wrong error detected')
        reverted = true;
      }
      assert.equal(reverted, true, "(flightSuretyData)Access is not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

      await config.flightSuretyApp.setOperatingStatus(false);

      reverted = false;
      try 
      {
        await config.flightSuretyApp.testing_mode();
      }
      catch(e) {
        assert.equal(e['reason'],'Contract is currently not operational','wrong error detected')
        reverted = true;
      }
      assert.equal(reverted, true, "(flightSuretyApp)Access is not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyApp.setOperatingStatus(true);

  });

  it('check initial airline data', async function () { // after this test, Airline1 is registered
    assert.equal(await config.flightSuretyData.getRegisteredAirlineNum.call(),1,"only 1 airline registered at start");
    const result = await config.flightSuretyData.getAirlineInfo.call(Airline1);
    assert.equal(result[0],true,"wrong first airline account registered");
    assert.equal(result[1],false,"first airline account has not been funded yet");
  });

  
  it('(airline) check only registered airline can be funded', async function () { //funded => registered,  after this test, Airline1 is funded
    let reverted = false;
    try{
        await config.flightSuretyApp.fundAccount({from: Airline2, value:10*config.weiMultiple});
    }
    catch(e){
        assert.equal(e['reason'],'Caller is not registered','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "Airline account should not be able be to funded if it hasn't registered");
    tx=await config.flightSuretyApp.fundAccount({from: Airline1, value:10*config.weiMultiple});
    const result = await config.flightSuretyData.getAirlineInfo.call(Airline1);
    assert.equal(result[1],true,"first airline account should have been funded");
    bal = await web3.eth.getBalance(config.flightSuretyData.address);
    assert.equal(bal,10*config.weiMultiple,"wrong funded value");
    truffleAssert.eventEmitted(tx, 'Funded', (ev) => {
        return ev.airline === Airline1;
    });
  });

  it('(airline) check only registered and funded airline can add new airlines', async function () { // after this test, Airline2 is registered
    let reverted = false;
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(Airline2, {from: Airline2});
    }
    catch(e) {
        assert.equal(e['reason'],'Caller is not registered','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "Airline should not be able to register another airline if it hasn't registered");

    tx = await config.flightSuretyApp.registerAirline(Airline2, {from: Airline1});
    const result = await config.flightSuretyData.getAirlineInfo.call(Airline2);
    assert.equal(result[0],true,"new airline account should have been registered");
    assert.equal(result[1],false,"new airline account has not been funded yet");
    truffleAssert.eventEmitted(tx, 'Registered', (ev) => {
        return ev.airline === Airline2;
    });
    reverted = false;
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(Airline3, {from: Airline2});
    }
    catch(e) {
        assert.equal(e['reason'],'Caller is not funded','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "Airline should not be able to register another airline if it hasn't been funded");
  });

  it('(airline) only funded airline can vote for new airlines and no repeat voting is allowed', async function () { 
    let vote_num = await config.flightSuretyData.get_vote_count.call(Airline5);
    assert.equal(vote_num,0,"should have no vote yet");
    let reverted = false;
    try{
        await config.flightSuretyApp.vote(Airline5,{from:Airline2});
    }
    catch(e){
        assert.equal(e['reason'],'Caller is not funded','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "Airline should not be able to vote if it hasn't funded");
    let tx = await config.flightSuretyApp.vote(Airline5,{from:Airline1});
    truffleAssert.eventEmitted(tx, 'Voted', (ev) => {
        return ev.new_airline === Airline5 && ev.original_airline === Airline1;
    });
    vote_num = await config.flightSuretyData.get_vote_count.call(Airline5);
    assert.equal(vote_num,1,"should have only 1 vote");
    reverted = false;
    try{
        await config.flightSuretyApp.vote(Airline5,{from:Airline1});
    }catch(e){
        assert.equal(e['reason'],'each registered airline can only vote once','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "repeat voting is not allowed");
  });

  it('(airline) check Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async function () {
    // after this test, Airline2 is funded, Airline3 and Airline4 are registered and funed, Airline5 is registered
    await config.flightSuretyApp.fundAccount({from: Airline2, value:10*config.weiMultiple});
    await config.flightSuretyApp.registerAirline(Airline3, {from: Airline2});  // register 3rd airline
    await config.flightSuretyApp.fundAccount({from: Airline3, value:10*config.weiMultiple});
    await config.flightSuretyApp.registerAirline(Airline4,{from:Airline3}); // register 4th airline
    await config.flightSuretyApp.fundAccount({from: Airline4, value:10*config.weiMultiple});
    let reverted = false;
    try{
        await config.flightSuretyApp.registerAirline(Airline5,{from:Airline4}); // try register 5th airline without 50% consensus
    }catch(e){
        assert.equal(e['reason'],'multi-party consensus of 50% is required','wrong error detected');
        reverted = true;
    }
    assert.equal(reverted, true, "multi-party consensus of 50% is required");
    await config.flightSuretyApp.vote(Airline5,{from:Airline2});
    vote_num = await config.flightSuretyData.get_vote_count.call(Airline5);
    assert.equal(vote_num,2,"should have 2 votes");
    assert.equal(await config.flightSuretyData.getRegisteredAirlineNum.call(),4,"there should be 4 registered airlines");
    await config.flightSuretyApp.registerAirline(Airline5,{from:Airline4}); // try register 5th airline with 50% consensus
    const result = await config.flightSuretyData.getAirlineInfo.call(Airline5);
    assert.equal(result[0],true,"new airline account should have been registered");
    assert.equal(result[1],false,"new airline account has not been funded yet");
  }); 

  it('(passenger) check if passenger can buy insurance', async function () {
    let init_bal = await web3.eth.getBalance(config.flightSuretyData.address);
    await config.flightSuretyApp.buyInsurance('ND1234',{from:passenger,value:0.5*config.weiMultiple});
    let after_bal = await web3.eth.getBalance(config.flightSuretyData.address);
    let bal_diff = after_bal - init_bal;
    assert.equal(bal_diff,0.5*config.weiMultiple,"wrong balance for contract");
    let insured_amount = await  config.flightSuretyData.getInsuranceAmount.call('ND1234',passenger);
    assert.equal(insured_amount,0.5*config.weiMultiple,"wrong balance for insurance");
  });

});