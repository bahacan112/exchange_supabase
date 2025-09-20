// Test login script
const testLogin = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Token:', data.token);
      console.log('User:', data.user);
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Test with different credentials
const testLoginWithEmail = async () => {
  try {
    // Artık email ile giriş yapıyoruz
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@exchange.local',  // Email gönderiyoruz
        password: 'admin123'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Token:', data.token);
      console.log('User:', data.user);
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

const testMultipleLogins = async () => {
  console.log('=== Testing Login API ===\n');
  
  // Test 1: Admin credentials from migration (using email)
  console.log('Test 1: Admin user (from migration) - Using email');
  await testLoginWithEmail();
  
  console.log('\n=== Test Complete ===');
};

testMultipleLogins();