import React from 'react'
import ReactDOM from 'react-dom'
import SaladUI from 'salad-ui'

class App extends React.Component{
  state = {
    text: "",
    conversation: [],
    prompt: null,
    client_id: null,
    context: {
      user: {
        name: "user"
      },
      bot: {
        name: "bot"
      },
      isAdmin: false
    }
  }

  componentWillMount(){
    let client_id = localStorage.getItem('client_identifier')
    if(!client_id){
      client_id = Math.random().toString(36).substring(2,20);
      localStorage.setItem('client_identifier', client_id)
    }
    this.setState({client_id: client_id})

    SaladUI.Lib.f.get(this.props.apiURL + '/history', {data: {
      client_id: client_id
    }})
    .then(res => {
      let newState = {conversation: res.conversation}
      if(res.context) newState.context = Object.assign({}, this.state.context, res.context)
      this.setState(newState, () => {
        this.refs.conversation.scrollTop = this.refs.conversation.scrollHeight
      })
    })
    .catch(err => console.warn(err))
  }

  formatText(text){
    return text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/>$2')
  }

  sendText(){
    let text = this.state.text
    if(this.state.prompt === 'auth.password') text = '******'
    this.setState({text:"", conversation: this.state.conversation.concat({text: text, from: 'user'})})
    SaladUI.Lib.f.post(this.props.apiURL + '/chat', {data: {
      message: this.state.text,
      prompt: this.state.prompt,
      client_id: this.state.client_id
    }})
    .then(res => {
      let newState = {conversation: this.state.conversation.concat({text: res.answer.text, from: "bot"}), prompt: res.answer.prompt}
      if(res.context) newState.context = Object.assign({}, this.state.context, res.context)
      this.setState(newState, () => {
        this.refs.conversation.scrollTop = this.refs.conversation.scrollHeight
      })
    })
    .catch(err => console.warn(err))
  }

  render(){
    return (
      <div ref="container" className="sambot">
        <div className="description">
          <h1>SamBot{this.state.context.isAdmin ? ' (admin)' : null}.</h1>
        </div>
        <div className="chat-area">
          <div className="conversation" ref="conversation">
            {this.state.conversation.map((phrase,index) =>
              <div key={`phrase.${index}`}><b style={{verticalAlign: 'top'}}>{this.state.context[phrase.from].name||phrase.from}:</b> <i dangerouslySetInnerHTML={{__html: this.formatText(phrase.text)}}/></div>
            )}
          </div>
          <form onSubmit={e=>{e.preventDefault();this.sendText()}}>
            <SaladUI.Form.InputText
              value={this.state.text}
              onChange={text=>this.setState({text})}
              type={this.state.prompt === 'auth.password' ? 'password' : 'text'}
              autofocus={true}/>
          </form>
        </div>
      </div>
    )
  }
}

let reactRoot = document.getElementById('react-root')
ReactDOM.render(<App apiURL="http://localhost:6020"/>, reactRoot)
