// Parsers for the homepage echo cards (iP138, IP.cn, IPinfo.io).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseIp138, parseIpCn, parseIpInfo } from '../frontend/utils/getips/parse-echo.js';

describe('parseIp138', () => {
  it('reads the address from the page title', () => {
    const html = '<html><title>您的IP地址是：61.169.45.46</title><a href="/">[61.169.45.46]</a></html>';
    assert.equal(parseIp138(html), '61.169.45.46');
  });

  it('falls back to the bracketed address', () => {
    assert.equal(parseIp138('您的IP地址是：[61.169.45.46]'), '61.169.45.46');
  });

  it('rejects a title that is not an IP', () => {
    assert.equal(parseIp138('您的IP地址是：not-an-ip'), '');
    assert.equal(parseIp138('您的IP地址是：999.999.999.999'), '');
    assert.equal(parseIp138(null), '');
  });
});

describe('parseIpCn', () => {
  it('reads the fullwidth colon form', () => {
    assert.equal(parseIpCn('ip：61.169.45.46 归属地：中国 上海 上海  电信'), '61.169.45.46');
  });

  it('reads an ascii colon', () => {
    assert.equal(parseIpCn('IP: 1.1.1.1'), '1.1.1.1');
  });

  it('rejects text with no address', () => {
    assert.equal(parseIpCn('归属地：上海'), '');
    assert.equal(parseIpCn(null), '');
  });
});

describe('parseIpInfo', () => {
  it('reads a JSON body', () => {
    assert.equal(parseIpInfo('{"ip":"162.128.207.179","city":"Singapore"}'), '162.128.207.179');
  });

  it('reads an already-parsed object', () => {
    assert.equal(parseIpInfo({ ip: '8.8.8.8' }), '8.8.8.8');
  });

  it('rejects junk', () => {
    assert.equal(parseIpInfo('not json'), '');
    assert.equal(parseIpInfo({}), '');
    assert.equal(parseIpInfo(null), '');
  });
});
