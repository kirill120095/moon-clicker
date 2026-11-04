import { TEMPLE_STAKES } from './temple-rules.js';
import { TEMPLE_ACCOUNT_RELEASE, templeReleaseBlockReason, buildTempleItemRequest, validateTempleAccountState, validateTempleItemResponse } from './temple-item-protocol.js';

/** Disabled-by-default projection of a FUTURE authoritative server.
 * No fetch/Supabase/storage/RNG and no local shards deduction or item granting.
 * The backend must independently authorize the real JWT subject and atomically
 * commit idempotent debit+inventory+versions. Client gates are not authorization.
 */
export class TempleAccountClient {
  constructor({release=TEMPLE_ACCOUNT_RELEASE,binding=()=>null,transport=null,requestId=()=>globalThis.crypto.randomUUID()}={}) {
    this.kind='account-items';this.release=Object.freeze({...release});this.binding=binding;this.transport=transport;this.requestId=requestId;
    this.stake=10;this.busy=false;this.last=null;this.lastError=null;this.pendingRequest=null;this.uncertain=false;
    this.stateVersion=null;this.inventoryVersion=null;this.shardsBalance=null;this.inventoryItems=null;this.lastDrops=[];
    this.bonus={remaining:0,triggerStake:null};
  }
  get blockReason() {
    const blocked=templeReleaseBlockReason(this.release,this.binding(),this.transport);
    if(blocked)return blocked;
    if(this.stateVersion===null||this.inventoryVersion===null)return 'AUTHORITATIVE_STATE_REQUIRED';
    if(this.uncertain)return 'RECONCILIATION_REQUIRED';
    return null;
  }
  get canSpin(){return !this.blockReason&&!this.busy&&(this.bonus.remaining>0||this.shardsBalance>=this.stake);}
  get balance(){return this.shardsBalance;}
  reload(){} // Never hydrates an account from the demo key or guesses server balance.
  clearProjection(){
    this.stateVersion=null;this.inventoryVersion=null;this.shardsBalance=null;
    this.inventoryItems=null;this.lastDrops=[];this.last=null;this.bonus={remaining:0,triggerStake:null};
  }
  reset(){this.lastError='ACCOUNT_RESET_NOT_ALLOWED';return false;}
  setStake(stake){
    if(!TEMPLE_STAKES.includes(stake))throw Error('Unsupported stake');
    if(this.busy||this.bonus.remaining||this.blockReason)return false;
    this.stake=stake;return true;
  }
  acceptState(raw){
    if(templeReleaseBlockReason(this.release,this.binding(),this.transport))return false;
    const next=validateTempleAccountState(raw,this.release);
    if(!this.isNewEnough(next))return false;
    this.applyState(next);return true;
  }
  isNewEnough(next){
    if(this.stateVersion!==null&&next.stateVersion<this.stateVersion)return false;
    if(this.inventoryVersion!==null&&next.inventoryVersion<this.inventoryVersion)return false;
    if(this.stateVersion!==null&&next.stateVersion===this.stateVersion&&next.shardsBalance!==this.shardsBalance)return false;
    if(this.inventoryItems!==null&&next.inventoryItems!==null&&next.inventoryVersion===this.inventoryVersion){
      const material=items=>JSON.stringify(items.map(i=>[i.instanceId,i.itemDefinitionId,i.quantity]).sort((a,b)=>a[0].localeCompare(b[0])));
      if(material(this.inventoryItems)!==material(next.inventoryItems))return false;
    }
    return true;
  }
  applyState(next){
    this.stateVersion=next.stateVersion;this.inventoryVersion=next.inventoryVersion;
    this.shardsBalance=next.shardsBalance;this.bonus={...next.bonus};
    // Do not synthesize a bag by merging awardedItems into a stale client inventory.
    this.inventoryItems=next.inventoryItems===null?null:structuredClone(next.inventoryItems);
  }
  async spin({mode,requestId,fixtureId}={}){
    if(this.busy)return null;
    const block=this.blockReason;if(block){this.lastError=block;return null;}
    if(fixtureId!==undefined)throw Error('Fixtures cannot enter account mode');
    mode??=this.bonus.remaining?'free':'paid';
    if((this.bonus.remaining>0)!==(mode==='free')||!['paid','free'].includes(mode)){this.lastError='WRONG_SPIN_MODE';return null;}
    if(!this.canSpin){this.lastError='INSUFFICIENT_SHARDS';return null;}
    this.busy=true; // Protect request preparation too, including injected ID factories.
    try {
      const id=requestId||this.requestId();
      if(id===this.last?.requestId){this.lastError='DUPLICATE_CONFIRMED';this.busy=false;return null;}
      const request=buildTempleItemRequest({requestId:id,mode,totalStake:mode==='free'?this.bonus.triggerStake:this.stake,
        expectedStateVersion:this.stateVersion,expectedInventoryVersion:this.inventoryVersion});
      this.pendingRequest=request;return await this.sendPending();
    } catch(error) { this.busy=false;throw error; }
  }
  async retryPending(){
    if(this.busy||!this.pendingRequest)return null;
    const blocked=templeReleaseBlockReason(this.release,this.binding(),this.transport);
    if(blocked){this.lastError=blocked;return null;}
    return this.sendPending(); // SAME requestId and payload, never a fresh spin.
  }
  async sendPending(){
    this.busy=true;this.lastError=null;
    const request=this.pendingRequest;
    try{
      const raw=await this.transport.spin(structuredClone(request));
      if(templeReleaseBlockReason(this.release,this.binding(),this.transport))throw Error('Session or project changed during request');
      const next=validateTempleItemResponse(raw,request,this.release);
      if(!this.isNewEnough(next))throw Error('Stale authoritative response');
      this.applyState(next);this.last=structuredClone(next);this.lastDrops=structuredClone(next.awardedItems);
      this.pendingRequest=null;this.uncertain=false;return this.last;
    }catch(error){
      this.uncertain=true;this.lastError='RECONCILIATION_REQUIRED';
      // Timeout/invalid response may follow a real commit. No optimistic refund,
      // reroll, fresh requestId, local grant, or automatic retry.
      return null;
    }finally{this.busy=false;}
  }
}
