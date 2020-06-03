import * as React from 'react';
import '../css/App.css';

export interface LoginProps {
    loginCallback(email: string, password: string): void
}

export const Login = function(props: LoginProps): React.ReactElement {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');

    const form = (
        <form>
            <div className="FormRow">
                <label>
                    Email:
                </label>
                <input type="text" value={email} onChange={ev => setEmail(ev.target.value)} />
            </div>
            <div className="FormRow">
                <label>
                    Password:
                </label>
                <input type="password" value={password} onChange={ev => setPassword(ev.target.value)} />
            </div>
            <div className="FormRow">
                <input type="submit" value="Log in" onClick={() => props.loginCallback(email, password)}/>
            </div>
        </form>
    );

    return (
        <div className="Content">
            {form}
        </div>
    );
};