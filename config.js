module.exports = {
            
        supabase: {
            url: 'https://thzhyhjdcqgnlfghlbsi.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoemh5aGpkY3FnbmxmZ2hsYnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMzE0MTcsImV4cCI6MjA3MDgwNzQxN30.K2LoWgrNsSu_MLd4ZK0eJXGuPLqc9jSYNK8VYXrDfR8'
        },
        
    smtp: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'aanto.selvan@gmail.com',
        password: 'pwur ovso vfpa xsqc'
    },
        
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development'
    },
        
    otp: {
        expiryMinutes: 15,
        length: 6
    }
};
