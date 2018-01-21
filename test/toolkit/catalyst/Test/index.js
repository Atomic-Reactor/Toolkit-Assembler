import { Component } from 'react';
import ReactDOM from 'react-dom';

class Test extends Component {
    render() {
        return <h1>Testing: {this.props.message}</h1>;
    }
}

ReactDOM.render(
    <Test message={123} />,
    document.getElementById('component-test')
);