(function(root){
  'use strict';
  let loading,auth,authSDK,db,storeSDK,callbacks,controller;
  const config=()=>root.TRACKLIST_FIREBASE_CONFIG;
  const configured=()=>!!(config()?.apiKey&&config()?.projectId&&config()?.authDomain&&config()?.appId);
  const userDoc=(uid)=>storeSDK.doc(db,'users',uid,'collections','main');
  const snapshotDoc=(uid,revision)=>storeSDK.doc(db,'users',uid,'snapshots',revision);
  const chunkDoc=(uid,revision,index)=>storeSDK.doc(db,'users',uid,'snapshots',revision,'chunks',String(index));
  function friendly(error){
    const codes={'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'This email already has an account. Try signing in.','auth/weak-password':'Use a stronger password with at least six characters.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/operation-not-allowed':'Enable Email/Password sign-in in your Firebase project.','permission-denied':'Account saving was blocked by database permissions. Your edits are kept on this device.','unavailable':'The cloud is unavailable. Your local changes are kept. Try again when connected.'};
    return codes[error.code]||error.message||'Cloud connection failed. Your local data is kept.';
  }
  const adapter={
    watch(uid,onHead,onError){return storeSDK.onSnapshot(userDoc(uid),{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)onHead(snap.exists()?snap.data():null);},error=>onError(new Error(friendly(error))));},
    async read(uid,head){
      if(!head||!Number.isInteger(head.parts)||head.parts<1||head.parts>60||!head.revision)throw new Error('Cloud snapshot is invalid. Export this device before resolving.');
      const docs=await Promise.all(Array.from({length:head.parts},(_,i)=>storeSDK.getDocFromServer(chunkDoc(uid,head.revision,i))));
      if(docs.some(d=>!d.exists()||typeof d.data().text!=='string'))throw new Error('Cloud snapshot is incomplete. Your local collection has been preserved.');
      return root.Tracklist.normalize(JSON.parse(docs.map(d=>d.data().text).join('')));
    },
    async write(uid,expected,revision,state){
      const parts=root.TracklistSyncModel.chunks(state),at=new Date().toISOString();let removed=[];
      const head=await storeSDK.runTransaction(db,async transaction=>{
        const current=await transaction.get(userDoc(uid));const previous=current.exists()?current.data():null;
        if((previous?.revision||null)!==expected){const error=new Error('Cloud revision changed.');error.code='tracklist/conflict';error.head=previous;throw error;}
        const entry={revision,parts:parts.length,at,rides:state.rides.length,wishlist:state.wishlist.length,parks:state.parkWishlist.length};
        const history=[entry,...(previous?.history||[])];removed=history.slice(10);
        const next={revision,parts:parts.length,at,rides:state.rides.length,wishlist:state.wishlist.length,history:history.slice(0,10)};
        transaction.set(snapshotDoc(uid,revision),entry);
        parts.forEach((text,index)=>transaction.set(chunkDoc(uid,revision,index),{text}));
        transaction.set(userDoc(uid),next);return next;
      });
      // Old revisions are removed only after a successful atomic save.
      for(const entry of removed){try{const batch=storeSDK.writeBatch(db);for(let i=0;i<entry.parts;i++)batch.delete(chunkDoc(uid,entry.revision,i));batch.delete(snapshotDoc(uid,entry.revision));await batch.commit();}catch{/* Retaining an extra backup is safe. */}}
      return head;
    },
    async history(uid){const head=await storeSDK.getDocFromServer(userDoc(uid));return head.exists()?head.data().history||[]:[];},
  };
  function init(options){callbacks=options;controller=new root.TracklistSyncModel.Coordinator({...options,adapter,revision:()=>root.Tracklist.uid(),online:()=>navigator.onLine,emptyState:()=>root.Tracklist.normalize({version:1,rides:[]})});return controller;}
  async function start(){
    if(!configured())throw new Error('Firebase is not configured yet. Follow FIREBASE_SETUP.md to enable cloud saving.');
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
  async function signOut(){if(!auth)return;await authSDK.signOut(auth);}
  async function resetPassword(email){await start();try{await authSDK.sendPasswordResetEmail(auth,email);}catch(error){throw new Error(friendly(error));}}
  const api={configured,init,start,signIn,signOut,resetPassword,user:()=>auth?.currentUser||null,adapter};root.TracklistCloud=api;
})(globalThis);
