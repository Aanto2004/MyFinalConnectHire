const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('./config');
require('dotenv').config();

const app = express();
const PORT = config.server.port;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const supabase = createClient(config.supabase.url, config.supabase.anonKey);


const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.password
    },
    debug: config.server.environment === 'development'
});

transporter.verify(function(error, success) {
    if (error) {
        console.error('SMTP connection error:', error);
    } else {
        console.log('SMTP server is ready to send emails');
    }
});

const createOTPEmail = (otpCode, purpose) => {
    const subject = purpose === 'signup' ? 'Welcome to ConnectHire - Verify Your Email' : 'ConnectHire - Sign In Verification';
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ConnectHire Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #667eea; color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 ConnectHire</h1>
                <p>Connect Developers with Employers</p>
            </div>
            <div class="content">
                <h2>${purpose === 'signup' ? 'Welcome to ConnectHire!' : 'Sign In to ConnectHire'}</h2>
                <p>${purpose === 'signup' ? 'Thank you for joining ConnectHire! To complete your registration, please use the verification code below:' : 'To sign in to your account, please use the verification code below:'}</p>
                
                <div class="otp-code">${otpCode}</div>
                
                <p><strong>This code will expire in 15 minutes.</strong></p>
                
                <p>If you didn't request this code, please ignore this email.</p>
                
                <p>Best regards,<br>The ConnectHire Team</p>
            </div>
            <div class="footer">
                <p>&copy; 2024 ConnectHire. All rights reserved.</p>
                <p>This is an automated email, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    return { subject, html };
};

// Routes
// Send OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, purpose } = req.body;
        
        if (!email || !purpose) {
            return res.status(400).json({ success: false, error: 'Email and purpose are required' });
        }
        
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        const { error: dbError } = await supabase
            .from('otp_verification')
            .insert([{
                email,
                otp_code: otpCode,
                purpose,
                expires_at: expiresAt.toISOString(),
                is_used: false
            }]);
        
        if (dbError) {
            console.error('Database error when storing OTP:', dbError);
            return res.status(500).json({ success: false, error: `Failed to store OTP: ${dbError.message}` });
        }
        
        try {
            const emailContent = createOTPEmail(otpCode, purpose);
            
            const mailOptions = {
                from: `"${process.env.SMTP_FROM_NAME || 'Connect hire'}" <${process.env.SMTP_FROM_EMAIL || 'aanto.selvan@gmail.com'}>`,
                to: email,
                subject: emailContent.subject,
                html: emailContent.html
            };
            
            await transporter.sendMail(mailOptions);
            
            res.json({ 
                success: true, 
                message: 'OTP sent successfully',
                expiresAt: expiresAt
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            
            if (process.env.NODE_ENV === 'development') {
                res.json({ 
                    success: true, 
                    message: 'OTP stored successfully (email failed)',
                    error: emailError.message,
                    otp: otpCode, // Only in development
                    expiresAt: expiresAt
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    error: `Failed to send email: ${emailError.message}. Please try again.` 
                });
            }
        }
        
    } catch (error) {
        console.error('OTP endpoint error:', error);
        res.status(500).json({ success: false, error: `Failed to send OTP: ${error.message}` });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;
        
        if (!email || !otp || !purpose) {
            return res.status(400).json({ success: false, error: 'Email, OTP, and purpose are required' });
        }
        
        const { data: otpRecords, error: dbFetchError } = await supabase
            .from('otp_verification')
            .select('*')
            .eq('email', email)
            .eq('otp_code', otp)
            .eq('purpose', purpose)
            .eq('is_used', false)
            .order('created_at', { ascending: false });
            
        if (dbFetchError) {
            console.error('Database error when fetching OTP:', dbFetchError);
            return res.status(500).json({ success: false, error: 'Database error when verifying OTP' });
        }
        
        if (!otpRecords || otpRecords.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid OTP code' });
        }
        
        const currentTime = new Date();
        const otpRecord = otpRecords.find(record => {
            const expiryTime = new Date(record.expires_at);
            return expiryTime > currentTime;
        });
        
        if (!otpRecord) {
            return res.status(400).json({ success: false, error: 'OTP has expired' });
        }
        
        await supabase
            .from('otp_verification')
            .update({ is_used: true })
            .eq('id', otpRecord.id);
        
        let { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (userError && purpose === 'signup') {
            // Create new user
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{ email }])
                .select()
                .single();
            
            if (createError) {
                throw createError;
            }
            user = newUser;
        } else if (userError && purpose === 'signin') {
            return res.status(400).json({ success: false, error: 'User not found. Please sign up first.' });
        }
        
        res.json({ 
            success: true, 
            message: 'OTP verified successfully',
            user: {
                id: user.id,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ 
            success: false, 
            error: `Failed to verify OTP: ${error.message || 'Unknown error'}` 
        });
    }
});

app.get('/api/auth/status', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }
        
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            return res.json({ 
                success: true, 
                authenticated: false 
            });
        }
        
        const { data: devProfile, error: devError } = await supabase
            .from('developer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        const { data: empProfile, error: empError } = await supabase
            .from('employer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        let profile = null;
        let role = null;
        
        if (devProfile && !devError) {
            profile = devProfile;
            role = 'developer';
        } else if (empProfile && !empError) {
            profile = empProfile;
            role = 'employer';
        }
        
        res.json({ 
            success: true, 
            authenticated: true,
            user: {
                id: user.id,
                email: user.email
            },
            profile: profile ? { ...profile, role } : null
        });
        
    } catch (error) {
        console.error('Auth status check error:', error);
        res.status(500).json({ 
            success: false, 
            error: `Failed to check auth status: ${error.message || 'Unknown error'}` 
        });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            error: `Failed to logout: ${error.message || 'Unknown error'}` 
        });
    }
});

app.post('/api/developer-profile', async (req, res) => {
    try {
        const { userId, ...profileData } = req.body;
        
        const { data: existingProfile, error: checkError } = await supabase
            .from('developer_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        let result;
        
        if (existingProfile && !checkError) {
            const { data, error } = await supabase
                .from('developer_profiles')
                .update(profileData)
                .eq('user_id', userId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from('developer_profiles')
                .insert([{
                    user_id: userId,
                    ...profileData
                }])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }
        
        res.json({ success: true, profile: result });
    } catch (error) {
        console.error('Developer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/developer-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('developer_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            // PGRST116: No rows found
            if (error.code === 'PGRST116') {
                return res.json({ success: true, profile: null });
            }
            throw error;
        }

        res.json({ success: true, profile: { ...data, role: 'developer' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/developer-profile', async (req, res) => {
    try {
        const { userId, ...profileData } = req.body;
        
        const { data, error } = await supabase
            .from('developer_profiles')
            .update(profileData)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, profile: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/employer-profile', async (req, res) => {
    try {
        const { userId, ...profileData } = req.body;
        
        const { data: existingProfile, error: checkError } = await supabase
            .from('employer_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        let result;
        
        if (existingProfile && !checkError) {
            const { data, error } = await supabase
                .from('employer_profiles')
                .update(profileData)
                .eq('user_id', userId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from('employer_profiles')
                .insert([{
                    user_id: userId,
                    ...profileData
                }])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }
        
        res.json({ success: true, profile: result });
    } catch (error) {
        console.error('Employer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/employer-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('employer_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            // PGRST116: No rows found
            if (error.code === 'PGRST116') {
                return res.json({ success: true, profile: null });
            }
            throw error;
        }

        res.json({ success: true, profile: { ...data, role: 'employer' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/employer-profile', async (req, res) => {
    try {
        const { userId, ...profileData } = req.body;
        
        const { data, error } = await supabase
            .from('employer_profiles')
            .update(profileData)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, profile: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/developer-profiles', async (req, res) => {
    try {
        const { location, skills, experience, limit = 50, offset = 0 } = req.query;
        
        let query = supabase
            .from('developer_profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (location) {
            query = query.ilike('preferred_job_location', `%${location}%`);
        }
        
        if (skills) {
            const skillsArray = skills.split(',').map(s => s.trim());
            query = query.overlaps('skills', skillsArray);
        }
        
        if (experience) {
            query = query.eq('experience', experience);
        }
        
        const { data, error } = await query
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        
        res.json({ success: true, developers: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/employer-profiles', async (req, res) => {
    try {
        const { location, industry, limit = 50, offset = 0 } = req.query;
        
        let query = supabase
            .from('employer_profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (location) {
            query = query.ilike('company_location', `%${location}%`);
        }
        
        if (industry) {
            query = query.ilike('industry', `%${industry}%`);
        }
        
        const { data, error } = await query
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        
        res.json({ success: true, employers: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/jobs', async (req, res) => {
    try {
        const { employerId, ...jobData } = req.body;
        
        if (!employerId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Employer ID is required' 
            });
        }
        
        const { data: employerProfile, error: employerError } = await supabase
            .from('employer_profiles')
            .select('id')
            .eq('id', employerId)
            .single();
        
        if (employerError || !employerProfile) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid employer profile' 
            });
        }
        
        const { data, error } = await supabase
            .from('jobs')
            .insert([{
                employer_id: employerId,
                ...jobData
            }])
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        res.json({ success: true, job: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/jobs', async (req, res) => {
    try {
        const { location, skills, limit = 50, offset = 0 } = req.query;

        let jobsQuery = supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (location) {
            jobsQuery = jobsQuery.ilike('location', `%${location}%`);
        }

        if (skills) {
            const skillsArray = skills.split(',').map(s => s.trim());
            jobsQuery = jobsQuery.overlaps('skills_required', skillsArray);
        }

        const { data: jobs, error: jobsError } = await jobsQuery;
        if (jobsError) throw jobsError;

        if (!jobs || jobs.length === 0) {
            return res.json({ success: true, jobs: [] });
        }

        const employerIds = [...new Set(jobs.map(j => j.employer_id).filter(Boolean))];
        let employersById = {};
        if (employerIds.length > 0) {
            const { data: employers, error: employersError } = await supabase
                .from('employer_profiles')
                .select('id, company_name, company_location, company_logo_url, name')
                .in('id', employerIds);
            if (employersError) throw employersError;
            employersById = (employers || []).reduce((acc, emp) => {
                acc[emp.id] = emp;
                return acc;
            }, {});
        }

        const enrichedJobs = jobs.map(job => ({
            ...job,
            employer_profiles: employersById[job.employer_id] || null
        }));

        res.json({ success: true, jobs: enrichedJobs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;

        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();
        if (jobError) throw jobError;

        if (!job) {
            return res.json({ success: true, job: null });
        }

        let employerProfile = null;
        if (job.employer_id) {
            const { data: emp, error: empError } = await supabase
                .from('employer_profiles')
                .select('company_name, company_location, company_logo_url, name, company_description')
                .eq('id', job.employer_id)
                .single();
            if (!empError) {
                employerProfile = emp;
            }
        }

        res.json({ success: true, job: { ...job, employer_profiles: employerProfile } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/applications', async (req, res) => {
    try {
        const { jobId, developerId, coverLetter } = req.body;
        
        const { data: existingApp } = await supabase
            .from('applications')
            .select('id')
            .eq('job_id', jobId)
            .eq('developer_id', developerId)
            .single();
        
        if (existingApp) {
            return res.status(400).json({ success: false, error: 'Already applied for this job' });
        }
        
        const { data, error } = await supabase
            .from('applications')
            .insert([{
                job_id: jobId,
                developer_id: developerId,
                cover_letter: coverLetter,
                status: 'pending'
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, application: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/applications/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                jobs!inner(*),
                developer_profiles!inner(
                    name,
                    photo_url,
                    skills,
                    experience,
                    short_description
                )
            `)
            .eq('job_id', jobId);
        
        if (error) throw error;
        
        const transformedApplications = data ? data.map(app => ({
            ...app,
            developer_profiles: app.developer_profiles ? {
                name: app.developer_profiles.name,
                photo_url: app.developer_profiles.photo_url,
                skills: app.developer_profiles.skills,
                experience: app.developer_profiles.experience,
                short_description: app.developer_profiles.short_description
            } : null
        })) : [];
        
        res.json({ success: true, applications: transformedApplications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/applications/:applicationId/status', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, notes } = req.body;
        
        const { data, error } = await supabase
            .from('applications')
            .update({
                status,
                notes,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', applicationId)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, application: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get applications for a specific developer
app.get('/api/applications/developer/:developerId', async (req, res) => {
    try {
        const { developerId } = req.params;
        
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                jobs!inner(
                    *,
                    employer_profiles!inner(
                        company_name,
                        company_location,
                        company_logo_url,
                        name
                    )
                )
            `)
            .eq('developer_id', developerId)
            .order('applied_at', { ascending: false });
        
        if (error) throw error;
        
        const transformedApplications = data ? data.map(app => ({
            ...app,
            jobs: app.jobs ? {
                ...app.jobs,
                employer_profiles: app.jobs.employer_profiles ? {
                    company_name: app.jobs.employer_profiles.company_name,
                    company_location: app.jobs.employer_profiles.company_location,
                    company_logo_url: app.jobs.employer_profiles.company_logo_url,
                    name: app.jobs.employer_profiles.name
                } : null
            } : null
        })) : [];
        
        res.json({ success: true, applications: transformedApplications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/jobs/employer/:employerId', async (req, res) => {
    try {
        const { employerId } = req.params;
        
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('employer_id', employerId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, jobs: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/applications/employer/:employerId', async (req, res) => {
    try {
        const { employerId } = req.params;
        
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                jobs!inner(
                    *,
                    employer_profiles!inner(
                        company_name,
                        company_location,
                        company_logo_url,
                        name
                    )
                ),
                developer_profiles!inner(
                    name,
                    photo_url,
                    skills,
                    experience,
                    short_description
                )
            `)
            .eq('jobs.employer_id', employerId)
            .order('applied_at', { ascending: false });
        
        if (error) throw error;
        
        const transformedApplications = data ? data.map(app => ({
            ...app,
            jobs: app.jobs ? {
                ...app.jobs,
                employer_profiles: app.jobs.employer_profiles ? {
                    company_name: app.jobs.employer_profiles.company_name,
                    company_location: app.jobs.employer_profiles.company_location,
                    company_logo_url: app.jobs.employer_profiles.company_logo_url,
                    name: app.jobs.employer_profiles.name
                } : null
            } : null,
            developer_profiles: app.developer_profiles ? {
                name: app.developer_profiles.name,
                photo_url: app.developer_profiles.photo_url,
                skills: app.developer_profiles.skills,
                experience: app.developer_profiles.experience,
                short_description: app.developer_profiles.short_description
            } : null
        })) : [];
        
        res.json({ success: true, applications: transformedApplications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/developers', async (req, res) => {
    try {
        const { skills, location, experience, limit = 50, offset = 0 } = req.query;
        
        let query = supabase
            .from('developer_profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (skills) {
            const skillsArray = skills.split(',').map(s => s.trim());
            query = query.overlaps('skills', skillsArray);
        }
        
        if (location) {
            query = query.ilike('location', `%${location}%`);
        }
        
        if (experience) {
            query = query.eq('experience', experience);
        }
        
        const { data, error } = await query
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        
        res.json({ success: true, developers: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/skills', async (req, res) => {
    try {
        const { category } = req.query;
        
        let query = supabase
            .from('skills')
            .select('*')
            .order('name');
        
        if (category) {
            query = query.eq('category', category);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        res.json({ success: true, skills: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/debug/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log('Debug: Checking user state for email:', email);
        
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            return res.json({
                success: false,
                error: 'User not found',
                email: email
            });
        }
        
        const { data: devProfile, error: devError } = await supabase
            .from('developer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        const { data: empProfile, error: empError } = await supabase
            .from('employer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        res.json({
            success: true,
            user: user,
            developerProfile: devProfile,
            employerProfile: empProfile,
            hasDeveloperProfile: !devError && devProfile,
            hasEmployerProfile: !empError && empProfile
        });
        
    } catch (error) {
        console.error('Debug user error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/test-db', async (req, res) => {
    try {
        const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .limit(1);
        
        if (jobsError) {
            return res.status(500).json({ 
                success: false, 
                error: 'Jobs table error: ' + jobsError.message 
            });
        }
        
        const { data: employerData, error: employerError } = await supabase
            .from('employer_profiles')
            .select('*')
            .limit(1);
        
        if (employerError) {
            return res.status(500).json({ 
                success: false, 
                error: 'Employer profiles table error: ' + employerError.message 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Database tables are accessible',
            jobs_count: jobsData?.length || 0,
            employers_count: employerData?.length || 0
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/test-otp', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('otp_verification')
            .select('*')
            .limit(5);
        
        if (error) {
            return res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'OTP table is accessible',
            count: data.length,
            data: data
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
        
        if (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database connection failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ 
            success: true, 
            message: 'ConnectHire API is running',
            database: 'Connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((error, req, res, next) => {
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 ConnectHire server running on port ${PORT}`);
    console.log(`📱 Open your browser and navigate to: http://localhost:${PORT}`);
});

module.exports = app;