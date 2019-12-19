class ViewerApp{
  constructor(){
    this.video1 = document.getElementById("video1");
    this.broadcasterList = document.getElementById("broadcasters");
    this.ws = new WebSocket("wss://10.202.83.23:3002");
    this.viewerId =  window.location.pathname.split('/')[2];
    this.pc = new RTCPeerConnection({
      iceServers:[{
        urls:"turn:10.202.83.23",
        username: "webrtc",
        credential: "turnserver"
      }]
    });
    this.target;
    this.init();
  }
  init(){
    // this.pc.oonicecandidate = ({candidate}) => this.signaling.send({candidate});
    this.pc = this.createPc.call(this);
    this.ws.onopen = () =>{
      this.ws.send(JSON.stringify(
        {
          action: "init viewer",
          viewerId: this.viewerId
        }
      ));
    }
    this.ws.onmessage = (data) => {
      let wsData = JSON.parse(data.data);

      if(wsData.action == "recieved broadcasters"){
        let links = "";
        wsData.broadcasters.forEach(element => {
          links += "<a data-streamerId='"+ element +"'>"+ element +"</a>" 
        });
        this.broadcasterList.innerHTML = links;
        document.querySelectorAll("#broadcasters > a").forEach(element => {
          element.onclick = this.getStream.bind(this);
        });
      }
      if(wsData.action == "send broadcast"){
        console.log(wsData.returnedDescription);
        let desc = new RTCSessionDescription(wsData.returnedDescription);
        this.pc.setRemoteDescription(desc).then(()=>{
          return this.pc.createAnswer()
        }).then((answer)=>{
          return this.pc.setLocalDescription(answer)
        })
        .then(()=>{
          this.ws.send(JSON.stringify({
            action: "send answer",
            target:this.target,
            viewerId: this.viewerId,
            description: this.pc.localDescription
          }))
        });
        // this.video1.srcObject = wsData.returnedVideoData;
      }
      if(wsData.action == "new-ice-candidate"){
        var candidate = new RTCIceCandidate(data.candidate);
        console.log("*** Adding received ICE candidate: " + JSON.stringify(data.candidate));
        this.pc.addIceCandidate({ target: data.target, candidate})

      }
    };
  }
  createPc(){
    let pc = new RTCPeerConnection({
      iceServers:[{
        urls:"turn:10.202.83.23",
        username: "webrtc",
        credential: "turnserver"
      }]
    });
    pc.onicecandidate = ({candidate}) => {      
      console.log("ice");
      console.log(candidate);
      this.ws.send(JSON.stringify({
        action: "new-ice-candidate",
        target: this.target,
        viewerId: this.viewerId,
        type:"viewer",
        candidate: candidate
      }));
    };
    pc.ontrack = (event)=>{
      console.log(event.streams[0]);
      console.log(this.video1);
      this.video1.srcObject = event.streams[0];
    }
    return pc;
  }
  getStream(event){
    this.target=  event.currentTarget.dataset.streamerid;
    console.log("add viewer");
    if(this.pc.iceConnectionState =="checking" || this.pc.iceConnectionState =="connected"|| this.pc.iceConnectionState == "completed"){
      this.pc.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });
      this.pc.close();
      this.pc = null;
    }
    this.pc =this.createPc.call(this);
    this.ws.send(JSON.stringify({
      action:"remove viewer",
      viewerId: this.viewerId
    }));
    this.ws.send(JSON.stringify({
      action: "add viewer",
      streamerId: event.currentTarget.dataset.streamerid,
      viewerId: this.viewerId 
    }));

  }

}
let app = new ViewerApp();