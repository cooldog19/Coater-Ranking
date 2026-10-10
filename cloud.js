(function(root){
  'use strict';
  let loading,auth,authSDK,db,storeSDK,callbacks,controller;
  const config=()=>root.TRACKLIST_FIREBASE_CONFIG;
  const configured=()=>!!(config()?.apiKey&&config()?.projectId&&config()?.authDomain&&config()?.appId);
  const userDoc=(uid)=>storeSDK.doc(db,'users',uid,'collections','main');
  const snapshotDoc=(uid,revision)=>storeSDK.doc(db,'users',uid,'snapshots',revision);
  const chunkDoc=(uid,revision,index)=>storeSDK.doc(db,'users',uid,'snapshots',revision,'chunks',String(index));
  function friendly(error){
    const codes={'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'Unable to create this account. Try logging in or resetting your password.','auth/weak-password':'Use a stronger password.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/operation-not-allowed':'Accounts are temporarily unavailable. Please try again later.','auth/network-request-failed':'Unable to connect. Check your internet connection and try again.','permission-denied':'Account saving is unavailable. Your edits are kept on this device. Try again later.','unavailable':'The cloud is unavailable. Your local changes are kept. Try again when connected.'};
    if(error.code==='auth/password-does-not-meet-requirements')return 'Choose a longer password with upper- and lowercase letters, a number and a symbol.';
    return codes[error.code]||'Account connection failed. Your local data is kept. Please try again later.';
  }
  const validEntry=entry=>!!entry&&typeof entry.revision==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(entry.revision)&&Number.isInteger(entry.parts)&&entry.parts>=1&&entry.parts<=60;
  const safeHistory=head=>Array.isArray(head?.history)?head.history.slice(0,10).filter(validEntry):[];
  const adapter={
    watch(uid,onHead,onError){return storeSDK.onSnapshot(userDoc(uid),{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)onHead(snap.exists()?snap.data():null);},error=>onError(new Error(friendly(error))));},
    async read(uid,head){
      if(!validEntry(head))throw new Error('Cloud snapshot is invalid. Export this device before resolving.');
      const docs=await Promise.all(Array.from({length:head.parts},(_,i)=>storeSDK.getDocFromServer(chunkDoc(uid,head.revision,i)))).catch(error=>{throw new Error(friendly(error));});
      if(docs.some(d=>!d.exists()||typeof d.data().text!=='string'||d.data().text.length>120000))throw new Error('Cloud snapshot is incomplete. Your local collection has been preserved.');
      const text=docs.map(d=>d.data().text).join('');
      if(new TextEncoder().encode(text).length>6*1024*1024)throw new Error('Cloud collection exceeds the supported size. Your local collection has been preserved.');
      try{return root.Tracklist.normalize(JSON.parse(text));}catch{throw new Error('Cloud collection could not be read. Your local collection has been preserved.');}
    },
    async write(uid,expected,revision,state){
      const parts=root.TracklistSyncModel.chunks(state),at=new Date().toISOString();let removed=[];
      const head=await storeSDK.runTransaction(db,async transaction=>{
        const current=await transaction.get(userDoc(uid));const previous=current.exists()?current.data():null;
        if((previous?.revision||null)!==expected){const error=new Error('Cloud revision changed.');error.code='tracklist/conflict';error.head=previous;throw error;}
        const entry={revision,parts:parts.length,at,rides:state.rides.length,wishlist:state.wishlist.length,parks:state.parkWishlist.length};
        const history=[entry,...safeHistory(previous)];removed=history.slice(10);
        const next={...entry,history:history.slice(0,10)};
        transaction.set(snapshotDoc(uid,revision),entry);
        parts.forEach((text,index)=>transaction.set(chunkDoc(uid,revision,index),{text}));
        transaction.set(userDoc(uid),next);return next;
      }).catch(error=>{if(error.code==='tracklist/conflict')throw error;throw new Error(friendly(error));});
      // Old revisions are removed only after a successful atomic save.
      for(const entry of removed){try{const batch=storeSDK.writeBatch(db);for(let i=0;i<entry.parts;i++)batch.delete(chunkDoc(uid,entry.revision,i));batch.delete(snapshotDoc(uid,entry.revision));await batch.commit();}catch{/* Retaining an extra backup is safe. */}}
      return head;
    },
    async history(uid){try{const head=await storeSDK.getDocFromServer(userDoc(uid));return head.exists()?safeHistory(head.data()):[];}catch(error){throw new Error(friendly(error));}},
  };
  function init(options){callbacks=options;controller=new root.TracklistSyncModel.Coordinator({...options,adapter,revision:()=>root.Tracklist.uid(),online:()=>navigator.onLine,emptyState:()=>root.Tracklist.normalize({version:1,rides:[]})});return controller;}
  async function start(){
    if(!configured())throw new Error('Account saving is currently unavailable. Your collection stays on this device.');
    if(loading)return loading;
    loading=(async()=>{
      const base='https://www.gstatic.com/firebasejs/12.19.0/';
      const [appSDK,a,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
      authSDK=a;storeSDK=f;const app=appSDK.initializeApp(config());auth=a.getAuth(app);db=f.getFirestore(app);
      // Session persistence is explicit; local collection copies remain account-specific.
      await a.setPersistence(auth,a.browserLocalPersistence);
      a.onAuthStateChanged(auth,user=>{
        const meta=callbacks.onAccount(user);controller.detach();
        if(user)controller.attach(user.uid,meta);
      });
      return auth;
    })().catch(error=>{loading=null;throw new Error(friendly(error));});
    return loading;
  }
  async function signIn(email,password,create=false){await start();try{return await (create?authSDK.createUserWithEmailAndPassword:authSDK.signInWithEmailAndPassword)(auth,email,password);}catch(error){throw new Error(friendly(error));}}
  async function signOut(){if(!auth)return;try{await authSDK.signOut(auth);}catch(error){throw new Error(friendly(error));}}
  async function resetPassword(email){await start();try{await authSDK.sendPasswordResetEmail(auth,email);}catch(error){throw new Error(friendly(error));}}
  const api={configured,init,start,signIn,signOut,resetPassword,user:()=>auth?.currentUser||null,adapter};root.TracklistCloud=api;
})(globalThis);
