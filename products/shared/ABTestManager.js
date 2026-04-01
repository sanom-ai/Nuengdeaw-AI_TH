'use strict';
// น้องหนึ่งเดียวAIโดย2026ตะวัน

// ============================================================================
// ABTestManager.js - A/B Test Framework + StorageManager
// Extracted from: nuengdeaw_simu.js (Section 10 - StorageManager, ABTestManager)
// Dependencies: none (uses localStorage directly)
// ============================================================================

const StorageManager = {
  KEYS:{ ABTESTS:'nuengdeaw_abtests', MODEL:'nuengdeaw_model_' },
  _storage(){
    if(typeof localStorage!=='undefined') return localStorage;
    return null;
  },
  getJSON(key,def){
    try{
      const storage=this._storage();
      if(!storage) return def;
      const v=storage.getItem(key);
      return v?JSON.parse(v):def;
    }catch{return def;}
  },
  // FIX #5: handle QuotaExceededError by pruning closed A/B tests before retrying the original write
  setJSON(key,val){
    try{
      const storage=this._storage();
      if(!storage) return false;
      storage.setItem(key,JSON.stringify(val));
      return true;
    }catch(e){
      if(e && (e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED')){
        console.warn('[StorageManager] QuotaExceeded on key:',key,'- attempting prune & retry');
        const allTests=key===this.KEYS.ABTESTS&&typeof val==='object'&&val!==null?val:this.getJSON(this.KEYS.ABTESTS,{});
        const pruned={};
        for(const[k,v] of Object.entries(allTests)){if(!v?.closed)pruned[k]=v;}
        try{
          const storage=this._storage();
          if(!storage) return false;
          storage.setItem(this.KEYS.ABTESTS,JSON.stringify(pruned));
          storage.setItem(key,JSON.stringify(val));
          return true;
        }catch{/* still not enough space */}
        console.error('[StorageManager] QuotaExceeded - write skipped. Consider calling ABTestManager.deleteTest() on old tests.');
      }
      return false;
    }
  },
  get(key){
    const storage=this._storage();
    return storage?storage.getItem(key):null;
  },
  set(key,val){
    try{
      const storage=this._storage();
      if(storage) storage.setItem(key,val);
    }catch(e){console.warn('[StorageManager] set failed:',e.name);}
  },
};

const ABTestManager = (() => {
  let _tests=StorageManager.getJSON(StorageManager.KEYS.ABTESTS,{})??{};
  const _save=()=>StorageManager.setJSON(StorageManager.KEYS.ABTESTS,_tests);
  const _normCDF=z=>{const t=1/(1+0.2316419*z);return 1-(1/Math.sqrt(2*Math.PI))*Math.exp(-0.5*z*z)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));};
  const _mean=(arr)=>arr.length?arr.reduce((s,v)=>s+v,0)/arr.length:0;
  const _variance=(arr,mean)=>arr.length>1?arr.reduce((s,v)=>s+(v-mean)**2,0)/(arr.length-1):0;
  const _welchT=(a,b)=>{
    if(a.length<2||b.length<2)return{t:0,p:1};
    const ma=_mean(a),mb=_mean(b);
    const va=_variance(a,ma),vb=_variance(b,mb);
    if(va+vb===0)return{t:0,p:1};
    const t=(ma-mb)/Math.sqrt(va/a.length+vb/b.length);
    return{t:+t.toFixed(3),p:+(2*(1-_normCDF(Math.abs(t)))).toFixed(4),ma:+ma.toFixed(3),mb:+mb.toFixed(3)};
  };
  const _getMeans=(test)=>{
    const means={};
    test.variants.forEach((variant)=>{const data=test.data[variant]??[];means[variant]=data.length>0?_mean(data):0;});
    return means;
  };
  const _pairwiseWelch=(test)=>{
    const comparisons=[];
    for(let i=0;i<test.variants.length;i++){
      for(let j=i+1;j<test.variants.length;j++){
        const a=test.variants[i],b=test.variants[j];
        const stats=_welchT(test.data[a]??[],test.data[b]??[]);
        comparisons.push({a,b,stats});
      }
    }
    const correctedAlpha=comparisons.length>0?0.05/comparisons.length:0.05;
    return{
      method:'pairwise-welch-bonferroni',
      correctedAlpha:+correctedAlpha.toFixed(4),
      comparisons:comparisons.map((item)=>({
        ...item,
        significant:item.stats.p<correctedAlpha,
      })),
    };
  };
  return{
    createTest(id,variants=['control','treatment'],metric='flow_ticks',durationTicks=0){_tests[id]={id,variants,metric,durationTicks,createdAt:Date.now(),closed:false,data:Object.fromEntries(variants.map(v=>[v,[]])),totalAssignments:Object.fromEntries(variants.map(v=>[v,0]))};_save();return _tests[id];},
    assign(testId){const t=_tests[testId];if(!t||t.closed)return null;const v=t.variants.reduce((a,b)=>t.totalAssignments[a]<=t.totalAssignments[b]?a:b);t.totalAssignments[v]++;_save();return v;},
    record(testId,variantName,value){const t=_tests[testId];if(!t||t.closed||!t.data[variantName])return;t.data[variantName].push(value);_save();},
    getResult(testId){const t=_tests[testId];if(!t)return null;const means=_getMeans(t);const winner=Object.entries(means).sort((a,b)=>b[1]-a[1])[0]?.[0]??null;const sampleSizes=Object.fromEntries(t.variants.map(v=>[v,(t.data[v]??[]).length]));if(t.variants.length<=2){const[v0,v1]=t.variants;const stats=_welchT(t.data[v0]??[],t.data[v1]??[]);return{winner,means,stats,significant:stats.p<0.05,sampleSizes};}const stats=_pairwiseWelch(t);return{winner,means,stats,comparisons:stats.comparisons,significant:stats.comparisons.some((item)=>item.significant),sampleSizes};},
    close(id){if(_tests[id]){_tests[id].closed=true;_save();}},
    listTests(){return Object.keys(_tests);},
    getTest(id){return _tests[id]??null;},
    deleteTest(id){delete _tests[id];_save();},
    exportAll(){return JSON.stringify(_tests,null,2);},
    importAll(json){try{_tests=JSON.parse(json);_save();return true;}catch{return false;}},
  };
})();

if(typeof window!=='undefined'){
  window.StorageManager = StorageManager;
  window.ABTestManager  = ABTestManager;
}
if(typeof module!=='undefined'&&module.exports) module.exports = { StorageManager, ABTestManager };

console.log('ABTestManager.js loaded');
