// Index route - redirects to thinking tab
import { Redirect } from 'expo-router';

export default function Index() {
    return <Redirect href="/thinking" />;
}
