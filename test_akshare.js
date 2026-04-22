async function testAkshareAPI() {
  const url = `http://82.push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024,m:0+t:3,m:1+t:3&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152,f124,f107,f104,f105,f140,f141,f207,f208,f209,f222`;
  const res = await fetch(url);
  const json = await res.json();
  const etfs = json.data.diff;
  
  const target = etfs.find(e => e.f12 === '159501');
  if (target) {
    console.log("Found 159501 data:");
    console.log("Price (f2):", target.f2 / 1000); 
    console.log(target);
  } else {
    console.log("159501 not found");
  }
}
testAkshareAPI();
