/* Conflict-aware sync coordinator. The Firebase adapter is injected for testing. */
(function(root){
  'use strict';
  class Coordinator {
    constructor(options){this.o=options;this.uid=null;this.base=null;this.dirty=false;this.status='local';this.remote=null;this.epoch=0;this.timer=null;this.writing=false;this.writingRevision=null;this.sequence=0;this.loadVersion=0;this.queuedHead=undefined;}
    report(status,message=''){this.status=status;this.message=message;this.o.onStatus?.(this);}
    metadata(){this.o.onMetadata?.({base:this.base,dirty:this.dirty});}
    attach(uid,meta={}){
      this.detach();this.uid=uid;this.base=meta.base||null;this.dirty=!!meta.dirty;const epoch=this.epoch;
      this.report('connecting');
      this.watchFailed=false;
      this.unsubscribe=this.o.adapter.watch(uid,head=>{if(this.epoch===epoch)this.receive(head);},error=>{if(this.epoch===epoch){this.watchFailed=true;this.report('error',error.message);}});
    }
    detach(){clearTimeout(this.timer);this.unsubscribe?.();this.unsubscribe=null;this.epoch++;this.sequence++;this.loadVersion++;this.uid=null;this.base=null;this.dirty=false;this.remote=null;this.writing=false;this.writingRevision=null;this.queuedHead=undefined;this.report('local');}
    changed(){if(!this.uid)return;this.dirty=true;this.sequence++;this.metadata();if(this.status==='conflict')return;this.report('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1000);}
    retry(){if(!this.uid)return;if(this.watchFailed||['error','offline','connecting'].includes(this.status)){const uid=this.uid,meta={base:this.base,dirty:this.dirty};this.attach(uid,meta);}else return this.flush();}
    async receive(head){
      if(!this.uid)return;
      if(head?.revision===this.writingRevision){this.queuedHead=undefined;return;}
      if(this.writing){this.queuedHead=head;return;}
      const loadVersion=++this.loadVersion;
      if((head?.revision||null)===this.base){if(this.dirty&&!this.writing)this.flush();else if(!this.writing)this.report('synced');return;}
      this.remote=head;
      if(this.dirty){this.report('conflict','This device and the cloud both have changes. Choose which collection to use.');return;}
      if(!head){this.base=null;this.metadata();this.report('synced');return;}
      const epoch=this.epoch,sequence=this.sequence;
      this.report('loading');
      try{
        const state=await this.o.adapter.read(this.uid,head);
        if(epoch!==this.epoch||loadVersion!==this.loadVersion)return;
        if(this.dirty||sequence!==this.sequence){this.remote=head;this.report('conflict','A cloud update arrived while you were editing. Your local changes are preserved.');return;}
        this.o.onRemote(state);this.base=head.revision;this.remote=null;this.metadata();this.report('synced');
      }catch(error){if(epoch===this.epoch)this.report('error',error.message);}
    }
    async flush(){
      if(!this.uid||!this.dirty||this.writing||this.status==='conflict')return;
      if(this.o.online&& !this.o.online()){this.report('offline','Saved on this device. Will retry when connected.');return;}
      const epoch=this.epoch,sequence=this.sequence,uid=this.uid,base=this.base;
      const state=this.o.getState(),revision=this.o.revision();
      this.writing=true;this.writingRevision=revision;this.report('saving');
      try{
        const head=await this.o.adapter.write(uid,base,revision,state);
        if(epoch!==this.epoch)return;
        this.base=head.revision;this.remote=null;
        // A delayed listener event for the previous head must not revert this save.
        if(this.queuedHead!==undefined&&((this.queuedHead?.revision||null)===base||head.history?.slice(1).some(h=>h.revision===this.queuedHead?.revision)))this.queuedHead=undefined;
        this.dirty=sequence!==this.sequence;this.metadata();this.report(this.dirty?'pending':'synced');
      }catch(error){
        if(epoch!==this.epoch)return;
        if(error.code==='tracklist/conflict'){this.remote=error.head;this.report('conflict','The cloud changed on another device. Your changes have not been overwritten.');}
        else this.report(this.o.online&&!this.o.online()?'offline':'error',error.message);
      }finally{
        if(epoch===this.epoch){this.writing=false;this.writingRevision=null;const queued=this.queuedHead;this.queuedHead=undefined;if(queued!==undefined&&(queued?.revision||null)!==this.base)this.receive(queued);else if(this.dirty&&this.status==='pending')this.flush();}
      }
    }
    async resolve(mode){
      if(!this.uid||this.status!=='conflict')return;
      const epoch=this.epoch,uid=this.uid,head=this.remote,sequence=this.sequence,loadVersion=++this.loadVersion;this.report('loading');
      try{
        if(mode==='cloud'){
          const state=head?await this.o.adapter.read(uid,head):this.o.emptyState();
          if(epoch!==this.epoch)return;
          if(sequence!==this.sequence||loadVersion!==this.loadVersion){this.remote=head;this.report('conflict','Your collection changed during recovery. Your local edits are preserved; choose again.');return;}
          this.o.onRemote(state);this.base=head?.revision||null;this.dirty=false;this.remote=null;this.metadata();this.report('synced');
        }else{
          if(mode==='merge'&&head){const remote=await this.o.adapter.read(uid,head);if(epoch!==this.epoch)return;this.o.onRemote(this.o.merge(remote,this.o.getState()));}
          this.base=head?.revision||null;this.remote=null;this.dirty=true;this.sequence++;this.metadata();this.report('pending');await this.flush();
        }
      }catch(error){if(epoch===this.epoch){this.remote=head;this.report('conflict',error.message);}}
    }
  }
  function chunks(state){
    const text=JSON.stringify(state);
    if(new TextEncoder().encode(text).length>6*1024*1024)throw new Error('This collection is too large for cloud sync (6 MB). Export a backup and reduce very long notes. Your local save is kept.');
    const parts=[];for(let i=0;i<text.length;){let end=Math.min(text.length,i+120000);if(end<text.length&&text.charCodeAt(end-1)>=0xD800&&text.charCodeAt(end-1)<=0xDBFF)end--;parts.push(text.slice(i,end));i=end;}return parts;
  }
  const api={Coordinator,chunks};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TracklistSyncModel=api;
})(globalThis);
